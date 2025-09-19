const axios = require("axios");
const { backendBase, backendToken } = require("../../config/botConfig");

async function callbackBackend(applicationNo, approver, status) {
  const url = `https://api.mch.ersan.click/admin-api/plt/withdrawal-application/check`;
  try {
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
          Authorization: `Bearer test1`,
          "Content-Type": "application/json"
        }
      }
    );
    return res.status === 200 || res.status === 204;
  } catch (err) {
    console.error("❌ 后端回调失败:", err.response?.data || err.message);
    return false;
  }
}

module.exports = { callbackBackend };
