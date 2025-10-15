const axios = require("axios");
const { backendBase, backendToken } = require("../../config/botConfig");
const { getErsanToken } = require("../../service/handle/handleOrder")
const { redis } = require("../../models/redisModel");

async function callbackBackend(applicationNo, approver, status) {
  const url = `https://api.pay.ersan.click/admin-api/plt/tg/withdraw/check`;
  try {
    const token = await getErsanToken(redis);
    const res = await axios.put(
      url,
      {
        approver,
        applicationNo,
        status
      },
      {
        headers: {
          "tenant-id": "1",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("res.status=" + res.status);
    return res.status === 200 || res.status === 204;
  } catch (err) {
    console.error("❌ 后端回调失败:", err.response?.data || err.message);
    return false;
  }
}

module.exports = { callbackBackend };
