const axios = require("axios");
const { getErsanToken } = require("../../service/handle/handleOrder");
const { redis } = require("../../models/redisModel");

async function callbackBackend(applicationNo, approver, status) {
  const url = `https://api.gamecloud.vip/admin-api/plt/tg/withdraw/platCheck`;
  try {
    const token = await getErsanToken(redis);
    const type = 4;
    const res = await axios.put(
      url,
      {
        approver,
        applicationNo,
        status,
        type
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

async function callbackAccountStatus(applicationNo, approver, status, type) {
  const url = `https://api.gamecloud.vip/admin-api/plt/tg/withdraw/platCheck`;
  try {
    if (![1, 2, 3, 5].includes(type)) {
      console.error("type 必须是 1、2、3、5");
      return false;
    }
    const token = await getErsanToken(redis);
    const res = await axios.put(
      url,
      {
        applicationNo,
        approver,
        status,
        type
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
  const url = `https://api.gamecloud.vip/admin-api/plt/tg/withdraw/mchCheck`;
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

module.exports = { callbackBackend, callbackAppStatus, callbackAccountStatus };
