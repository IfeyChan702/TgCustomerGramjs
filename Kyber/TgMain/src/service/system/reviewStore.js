const { redis } = require("../../models/redisModel");

// Key 约定
const keyDecided = (orderId) => `decided:${orderId}`;
const keyReviewers = (orderId) => `reviewers:${orderId}`;
const keyPending = (userId) => `pending:${userId}`;

// ✅ 新增：审核状态 Key
const keyReviewStatus = (orderId) => `review:status:${orderId}`;

// 幂等：尝试占位（谁先处理谁生效）
async function tryDecide(orderId, ttlSec = 2 * 3600) {
  return (await redis.set(keyDecided(orderId), "1", { NX: true, EX: ttlSec })) === "OK";
}
async function isDecided(orderId) {
  return (await redis.exists(keyDecided(orderId))) === 1;
}

// 审核人白名单
async function setReviewers(orderId, reviewerIds = [], needCount = 1) {
  const k = keyReviewers(orderId);
  const sKey = keyReviewStatus(orderId);

  // 清理旧值
  await redis.del(k, sKey);

  // 存白名单
  if (reviewerIds.length) {
    await redis.sAdd(k, reviewerIds.map(String));
    await redis.expire(k, 3 * 24 * 3600);
  }

  // 存审核状态（hash）
  await redis.hSet(sKey, {
    needCount: needCount, // 需要几人确认
    decided: 0,           // 是否已处理
    approvedBy: JSON.stringify([]), // 已确认人ID列表
  });
  await redis.expire(sKey, 3 * 24 * 3600);
}

// ✅ 获取审核状态
async function getReviewStatus(orderId) {
  const sKey = keyReviewStatus(orderId);
  const data = await redis.hGetAll(sKey);
  if (!data || !data.needCount) return null;

  return {
    needCount: Number(data.needCount),
    decided: data.decided === "1",
    approvedBy: JSON.parse(data.approvedBy || "[]"),
  };
}

// ✅ 更新审核状态
async function saveReviewStatus(orderId, info) {
  const sKey = keyReviewStatus(orderId);
  await redis.hSet(sKey, {
    needCount: info.needCount,
    decided: info.decided ? 1 : 0,
    approvedBy: JSON.stringify(info.approvedBy || []),
  });
}

async function isReviewer(orderId, userId) {
  const k = keyReviewers(orderId);
  const exists = await redis.sendCommand(['EXISTS', k]);
  if (Number(exists) === 0) return true;
  const r = await redis.sendCommand(['SISMEMBER', k, String(userId)]);
  return Number(r) === 1;
}

// 待提交拒绝理由
async function setPending(userId, payload) {
  await redis.set(keyPending(userId), JSON.stringify(payload), { EX: 3600 });
}
async function getPending(userId) {
  const val = await redis.get(keyPending(userId));
  try { return val ? JSON.parse(val) : null; } catch { return null; }
}
async function clearPending(userId) {
  await redis.del(keyPending(userId));
}

module.exports = {
  tryDecide, isDecided,
  setReviewers, isReviewer,
  getReviewStatus, saveReviewStatus,
  setPending, getPending, clearPending,
};
