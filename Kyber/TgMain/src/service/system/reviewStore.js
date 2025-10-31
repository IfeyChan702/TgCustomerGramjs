const { redis } = require("../../models/redisModel");
const { deleteOrderById } = require("../tgOrderService");

// Key 约定
const keyDecided = (orderId) => `decided:${orderId}`;
const keyReviewers = (orderId) => `reviewers:${orderId}`;
const keyApprovers = (orderId) => `approvers:${orderId}`;
const keyStageStatus = (stage, orderId) => `reviewers:status${stage}:${orderId}`;
const keyPending = (userId) => `pending:${userId}`;

async function tryDecide(orderId, ttlSec = 2 * 3600) {
  return (await redis.set(keyDecided(orderId), "1", { NX: true, EX: ttlSec })) === "OK";
}

async function isDecided(orderId) {
  return (await redis.exists(keyDecided(orderId))) === 1;
}

async function setReviewers(orderId, reviewerIds = [], needCount = 1) {
  const k = keyReviewers(orderId);
  const sKey = keyStageStatus("audit", orderId);
  await redis.del(k, sKey);

  if (reviewerIds.length) {
    await redis.sAdd(k, reviewerIds.map(String));
    await redis.expire(k, 7 * 24 * 3600);
  }

  await redis.hSet(sKey, {
    needCount,
    decided: 0,
    approvedBy: JSON.stringify([])
  });
  await redis.expire(sKey, 7 * 24 * 3600);
}

async function setApprovers(orderId, approverIds = [], needCount = 1) {
  const k = keyApprovers(orderId);
  const sKey = keyStageStatus("approve", orderId);
  await redis.del(k, sKey);

  if (approverIds.length) {
    await redis.sAdd(k, approverIds.map(String));
    await redis.expire(k, 7 * 24 * 3600);
  }

  await redis.hSet(sKey, {
    needCount,
    decided: 0,
    approvedBy: JSON.stringify([])
  });
  await redis.expire(sKey, 7 * 24 * 3600);
}

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

async function getStageStatus(orderId, stage) {
  const key = keyStageStatus(stage,orderId);
  const data = await redis.hGetAll(key);
  if (!data || !data.needCount) return null;
  return {
    needCount: Number(data.needCount),
    decided: data.decided === "1",
    approvedBy: JSON.parse(data.approvedBy || "[]"),
  };
}

async function saveStageStatus(orderId, stage, info) {
  const key = keyStageStatus(stage, orderId);
  await redis.hSet(key, {
    needCount: info.needCount,
    decided: info.decided ? 1 : 0,
    approvedBy: JSON.stringify(info.approvedBy || []),
  });
}

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
  setReviewers, setApprovers,
  isReviewer, isApprover,
  getStageStatus, saveStageStatus,
  setPending, getPending, clearPending,
};
