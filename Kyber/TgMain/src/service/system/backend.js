const axios = require("axios");
const { backendBase, backendToken } = require("../../config/botConfig");

async function callbackBackend(orderId, action, reviewerId, reason) {
  if (!backendBase || !backendToken) return true;
  const url = `${backendBase}/api/withdrawals/${orderId}/${action === "ok" ? "approve" : "reject"}`;
  /*try {
    const res = await axios.post(
      url,
      { reviewer_id: reviewerId, reason },
      { headers: { Authorization: `Bearer ${backendToken}` } }
    );
    return res.status === 200 || res.status === 204;
  } catch (err) {
    console.error("❌ 后端回调失败:", err.message);
    return false;
  }*/
}

module.exports = { callbackBackend };
