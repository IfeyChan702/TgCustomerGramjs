const axios = require("axios");
const { getErsanToken } = require("../../service/handle/handleOrder");
const { redis } = require("../../models/redisModel");

async function callbackBackend(applicationNo, approver, status) {
  const url = `https://api.gamecloud.vip/admin-api/plt/tg/withdraw/platCheck`;
  //const url = `https://api.pay.ersan.click/admin-api/plt/tg/withdraw/platCheck`;
  const method = "PUT";
  const type = 4;

  const start = Date.now();

  try {
    const token = await getErsanToken(redis);

    const payload = { applicationNo, approver, status, type };

    const headers = {
      "tenant-id": "1",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    console.log("[callbackBackend] 👉 request:", {
      url,
      method,
      payload,
      headers: {
        ...headers,
        Authorization: `Bearer ${token ? token.slice(0, 10) + "...(hidden)" : "null"}`,
      },
    });

    const res = await axios.put(url, payload, { headers });

    console.log("[callbackBackend] ✅ response:", {
      status: res.status,
      statusText: res.statusText,
      costMs: Date.now() - start,
      data: res.data,
      // headers: res.headers, // 需要时再开，避免日志太大
    });

    console.log("[callbackBackend] backend result:", {
      code: res.data?.code,
      msg: res.data?.msg || res.data?.message,
      data: res.data?.data,
    });

    if (res.status === 200 && res.data?.code === 0) {
      return !!res.data.data;
    }

    console.warn("[callbackBackend] ⚠️ 回调返回异常:", res.data);
    return false;
  } catch (err) {
    console.error("[callbackBackend] ❌ request failed:", {
      url,
      method,
      costMs: Date.now() - start,
      message: err.message,
      code: err.code,
      requestPayload: { applicationNo, approver, status, type },
      responseStatus: err.response?.status,
      responseData: err.response?.data,
      // responseHeaders: err.response?.headers, // 需要时再开
    });
    return false;
  }
}

async function callbackAccountStatus(applicationNo, approver, status, type) {
  const url = `https://api.gamecloud.vip/admin-api/plt/tg/withdraw/platCheck`;
  //const url = `https://api.pay.ersan.click/admin-api/plt/tg/withdraw/platCheck`;
  const method = "PUT";

  const payload = { applicationNo, approver, status, type };

  // 统一计时
  const start = Date.now();

  try {
    if (![1, 2, 3, 5].includes(type)) {
      console.error("[callbackAccountStatus] ❌ invalid type:", { type, allow: [1, 2, 3, 5] });
      return false;
    }

    const token = await getErsanToken(redis);

    const headers = {
      "tenant-id": "1",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 请求日志（token 脱敏）
    console.log("[callbackAccountStatus] 👉 request:", {
      url,
      method,
      payload,
      headers: {
        ...headers,
        Authorization: `Bearer ${token ? token.slice(0, 10) + "...(hidden)" : "null"}`,
      },
    });

    const res = await axios.put(url, payload, { headers });

    // 响应日志（结构化）
    console.log("[callbackAccountStatus] ✅ response:", {
      status: res.status,
      statusText: res.statusText,
      costMs: Date.now() - start,
      data: res.data,
      // headers: res.headers, // 需要排障再打开，避免日志太大
    });

    // 业务结果快速查看
    console.log("[callbackAccountStatus] backend result:", {
      code: res.data?.code,
      msg: res.data?.msg || res.data?.message,
      data: res.data?.data,
    });

    if (res.status === 200 && res.data?.code === 0) {
      return !!res.data.data;
    }

    console.warn("[callbackAccountStatus] ⚠️ callback abnormal:", res.data);
    return false;

  } catch (err) {
    console.error("[callbackAccountStatus] ❌ request failed:", {
      url,
      method,
      costMs: Date.now() - start,
      message: err.message,
      code: err.code,
      requestPayload: payload,
      responseStatus: err.response?.status,
      responseData: err.response?.data,
      // responseHeaders: err.response?.headers, // 需要时再开
    });
    return false;
  }
}

async function callbackAppStatus(applicationNo, confirmer, confirmStatus) {
  const url = `https://api.gamecloud.vip/admin-api/plt/tg/withdraw/mchCheck`;
  //const url = `https://api.pay.ersan.click/admin-api/plt/tg/withdraw/mchCheck`;
  const method = "PUT";

  const payload = { applicationNo, confirmer, confirmStatus };

  const start = Date.now();

  try {
    const token = await getErsanToken(redis);

    const headers = {
      "tenant-id": "1",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    console.log("[callbackAppStatus] 👉 request:", {
      url,
      method,
      payload,
      timeout: 10000,
      headers: {
        ...headers,
        Authorization: `Bearer ${token ? token.slice(0, 10) + "...(hidden)" : "null"}`,
      },
    });

    // 直接复用 payload，避免写两遍
    const res = await axios.put(url, payload, {
      headers,
      timeout: 10000,
    });

    console.log("[callbackAppStatus] ✅ response:", {
      status: res.status,
      statusText: res.statusText,
      costMs: Date.now() - start,
      data: res.data,
      // headers: res.headers, // 需要时再打开
    });

    console.log("[callbackAppStatus] backend result:", {
      code: res.data?.code,
      msg: res.data?.msg || res.data?.message,
      data: res.data?.data,
    });

    if (res.status === 200 && res.data?.code === 0) {
      return !!res.data.data;
    }

    console.warn("[callbackAppStatus] ⚠️ callback abnormal:", res.data);
    return false;

  } catch (err) {
    console.error("[callbackAppStatus] ❌ request failed:", {
      url,
      method,
      timeout: 10000,
      costMs: Date.now() - start,
      message: err.message,
      code: err.code,
      requestPayload: payload,
      responseStatus: err.response?.status,
      responseData: err.response?.data,
      // responseHeaders: err.response?.headers, // 需要时再开
    });
    return false;
  }
}


module.exports = { callbackBackend, callbackAppStatus, callbackAccountStatus };
