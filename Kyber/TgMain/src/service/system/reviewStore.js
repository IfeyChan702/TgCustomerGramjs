const { redis } = require("../../models/redisModel");

// Key 约定
const keyDecided = (orderId) => `decided:${orderId}`;
const keyReviewers = (orderId) => `reviewers:${orderId}`;
const keyApprovers = (orderId) => `approvers:${orderId}`;
const keyStageStatus = (stage, orderId) => `reviewers:status${stage}:${orderId}`;
const keyPending = (userId) => `pending:${userId}`;
const ORDER_TTL_SEC = 30 * 24 * 3600;
const DECIDED_TTL_SEC = 2 * 3600;

async function tryDecide(orderId, ttlSec = DECIDED_TTL_SEC) {
  return (await redis.set(keyDecided(orderId), "1", { NX: true, EX: ttlSec })) === "OK";
}

async function isDecided(orderId) {
  return (await redis.exists(keyDecided(orderId))) === 1;
}

async function setReviewers(orderId, reviewerIds = [], needCount = 1) {
  const k = keyReviewers(orderId);
  const sKey = keyStageStatus("audit", orderId);

  // 初始化会清空旧数据（注意：这会清空 approvedBy 进度）
  await redis.del(k, sKey);

  if (reviewerIds.length) {
    await redis.sAdd(k, reviewerIds.map(String));
    await redis.expire(k, ORDER_TTL_SEC);
  }

  await redis.hSet(sKey, {
    needCount,
    decided: 0,
    approvedBy: JSON.stringify([]),
  });
  await redis.expire(sKey, ORDER_TTL_SEC);
}

async function setApprovers(orderId, approverIds = [], needCount = 1) {
  const k = keyApprovers(orderId);
  const sKey = keyStageStatus("approve", orderId);

  // 初始化会清空旧数据（注意：这会清空 approvedBy 进度）
  await redis.del(k, sKey);

  if (approverIds.length) {
    await redis.sAdd(k, approverIds.map(String));
    await redis.expire(k, ORDER_TTL_SEC);
  }

  await redis.hSet(sKey, {
    needCount,
    decided: 0,
    approvedBy: JSON.stringify([]),
  });
  await redis.expire(sKey, ORDER_TTL_SEC);
}

// ========== 权限判断 ==========
async function isReviewer(orderId, userId) {
  const k = keyReviewers(orderId);
  if ((await redis.exists(k)) === 0) return false;
  return (await redis.sIsMember(k, String(userId))) === 1;
}

async function isApprover(orderId, userId) {
  const k = keyApprovers(orderId);
  if ((await redis.exists(k)) === 0) return false;
  return (await redis.sIsMember(k, String(userId))) === 1;
}
// ========== 阶段状态读写 ==========
async function getStageStatus(orderId, stage) {
  const key = keyStageStatus(stage, orderId);
  const data = await redis.hGetAll(key);
  if (!data || !data.needCount) return null;

  let approvedBy = [];
  try {
    approvedBy = JSON.parse(data.approvedBy || "[]");
    if (!Array.isArray(approvedBy)) approvedBy = [];
  } catch {
    approvedBy = [];
  }

  return {
    needCount: Number(data.needCount),
    decided: data.decided === "1",
    approvedBy,
  };
}

// 不强制 expire；如果你希望每次保存都续期，可以打开下面这行
async function saveStageStatus(orderId, stage, info) {
  const key = keyStageStatus(stage, orderId);
  await redis.hSet(key, {
    needCount: Number(info.needCount || 1),
    decided: info.decided ? 1 : 0,
    approvedBy: JSON.stringify(info.approvedBy || []),
  });
  // 下面是续期
  // await redis.expire(key, ORDER_TTL_SEC);
}

// ========== pending（与订单无关，用于用户交互上下文） ==========
async function setPending(userId, payload) {
  await redis.set(keyPending(userId), JSON.stringify(payload), { EX: 3600 });
}
async function getPending(userId) {
  const val = await redis.get(keyPending(userId));
  try {
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}
async function clearPending(userId) {
  await redis.del(keyPending(userId));
}

// ========== 续期：不重置内容，只延长 TTL ==========
async function refreshOrderTTL(orderId, ttlSec = ORDER_TTL_SEC) {
  const keys = [
    keyReviewers(orderId),
    keyApprovers(orderId),
    keyStageStatus("audit", orderId),
    keyStageStatus("approve", orderId),
    keyStageStatus("complete", orderId)
    //keyDecided(orderId),
  ];

  for (const k of keys) {
    if ((await redis.exists(k)) === 1) {
      await redis.expire(k, ttlSec);
    }
  }
  return true;
}

// ========== 自愈补齐：缺什么补什么，不清空已投票进度 ==========
async function ensureOrderKeys(
  orderId,
  {
    reviewerIds = [],
    approverIds = [],
    needAudit = 1,
    needApprove = 1,
  } = {},
  ttlSec = ORDER_TTL_SEC
) {
  const kR = keyReviewers(orderId);
  const kA = keyApprovers(orderId);
  const sAudit = keyStageStatus("audit", orderId);
  const sApprove = keyStageStatus("approve", orderId);

  // reviewers set
  if ((await redis.exists(kR)) === 0) {
    if (reviewerIds.length) {
      await redis.sAdd(kR, reviewerIds.map(String));
    } else {
      // 没有 reviewerIds 就不创建空 set（空 set 无意义）
    }
  }

  // approvers set
  if ((await redis.exists(kA)) === 0) {
    if (approverIds.length) {
      await redis.sAdd(kA, approverIds.map(String));
    }
  }

  // stage audit hash：不存在就创建；存在但字段不全就补齐
  if ((await redis.exists(sAudit)) === 0) {
    await redis.hSet(sAudit, {
      needCount: Number(needAudit || 1),
      decided: 0,
      approvedBy: JSON.stringify([]),
    });
  } else {
    const data = await redis.hGetAll(sAudit);
    const patch = {};
    if (!data.needCount) patch.needCount = Number(needAudit || 1);
    if (!data.decided) patch.decided = 0;
    if (!data.approvedBy) patch.approvedBy = JSON.stringify([]);
    if (Object.keys(patch).length) await redis.hSet(sAudit, patch);
  }

  // stage approve hash
  if ((await redis.exists(sApprove)) === 0) {
    await redis.hSet(sApprove, {
      needCount: Number(needApprove || 1),
      decided: 0,
      approvedBy: JSON.stringify([]),
    });
  } else {
    const data = await redis.hGetAll(sApprove);
    const patch = {};
    if (!data.needCount) patch.needCount = Number(needApprove || 1);
    if (!data.decided) patch.decided = 0;
    if (!data.approvedBy) patch.approvedBy = JSON.stringify([]);
    if (Object.keys(patch).length) await redis.hSet(sApprove, patch);
  }

  // 统一续期（只对存在的 key 生效）
  await refreshOrderTTL(orderId, ttlSec);
  return true;
}

module.exports = {
  tryDecide,
  isDecided,

  setReviewers,
  setApprovers,

  isReviewer,
  isApprover,

  getStageStatus,
  saveStageStatus,

  refreshOrderTTL,
  ensureOrderKeys,

  setPending,
  getPending,
  clearPending,
};
