const { redis } = require("../../models/redisModel");

// Key 约定
const keyDecided = (orderId) => `decided:${orderId}`;
const keyReviewers = (orderId) => `reviewers:${orderId}`;
const keyPending = (userId) => `pending:${userId}`;

// 幂等：尝试占位（谁先处理谁生效）
async function tryDecide(orderId, ttlSec = 2 * 3600) {
  return (await redis.set(keyDecided(orderId), "1", { NX: true, EX: ttlSec })) === "OK";
}
async function isDecided(orderId) {
  return (await redis.exists(keyDecided(orderId))) === 1;
}

// 审核人白名单
async function setReviewers(orderId, reviewerIds = []) {
  const k = keyReviewers(orderId);
  await redis.del(k);
  if (reviewerIds.length) {
    await redis.sAdd(k, reviewerIds.map(String));
    await redis.expire(k, 3 * 24 * 3600);
  }
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
  setPending, getPending, clearPending,
};
