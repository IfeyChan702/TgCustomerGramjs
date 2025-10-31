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
    if (res.status === 200 && res.data?.code === 0) {
      return !!res.data.data;
    } else {
      console.warn("⚠️ 回调返回异常:", res.data);
      return false;
    }
  } catch (err) {
    console.error("❌ 后端回调失败:", err.response?.data || err.message);
    return false;
  }
}

async function callbackAppStatus(applicationNo, confirmer, confirmStatus) {
  const url = `https://api.pay.ersan.click/admin-api/plt/tg/withdraw/mchCheck`;
  try {
    const token = await getErsanToken(redis);
    const res = await axios.put(
      url,
      {
        applicationNo,
        confirmer,
        confirmStatus
      },
      {
        headers: {
          "tenant-id": "1",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    console.log("res.status=" + res.status);
    if (res.status === 200 && res.data?.code === 0) {
      return !!res.data.data;
    } else {
      console.warn("⚠️ 回调返回异常:", res.data);
      return false;
    }
  } catch (err) {
    console.error("❌ 后端回调失败:", err.response?.data || err.message);
    return false;
  }
}

module.exports = { callbackBackend,callbackAppStatus };
