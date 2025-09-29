const tgDbService = require("../../../../service/tgDbService");
const axios = require("axios");
const { getErsanToken } = require("../../../../service/handle/handleOrder");
const sysMerchantChatService = require("../../../../service/system/sysMerchantChatService");
const { redis } = require("../../../../models/redisModel");


const AUTO_FILLED_PARAMS = new Set(["merchantNo"]);

async function requestErsanUrl(command, userArgs, chatId) {
  try {
    const token = await getErsanToken(redis);


    if (!chatId) {
      console.warn(`[merCommand requestErsanUrl]=找不到chatId,chatId=`, chatId);
      return;
    }

    const merchantNo = await sysMerchantChatService.getMerchantNoByChatId(String(chatId));

    if (!merchantNo) {
      console.warn(`[merCommand requestErsanUrl] 找不到 merchantNo, chatId=`, chatId);
      return;
    }

    const params = await tgDbService.getParamsByCommandId(command.id) || [];
    const requiredParams = params.filter(p => p.required === 1);
    const effectiveRequiredCount = requiredParams
      .filter(p => !AUTO_FILLED_PARAMS.has(p.parameter_name))
      .length;
    if (userArgs.length < effectiveRequiredCount) {
      return `⚠️ 参数不足，至少需要 ${effectiveRequiredCount} 个参数`;
    }
    const body = {};
    const argCount = Math.min(userArgs.length, params.length);
    for (let i = 0; i < argCount; i++) {
      const name = params[i].parameter_name;
      const userValue = userArgs[i] ?? "";
      body[name] = userValue;
    }

    body.merchantNo = merchantNo;

    const headers = {
      Authorization: `Bearer ${token}`,
      "tenant-id": "1"
    };

    const method = String(command.method || "GET").toUpperCase();
    let response;
    const axiosCfg = { headers, timeout: 15000 };
    if (method === "GET") {
      response = await axios.get(command.url, { ...axiosCfg, params: body });
    } else {
      response = await axios.post(command.url, body, axiosCfg);
    }

    if (typeof response?.data?.code !== "undefined" && response.data.code !== 0) {
      console.warn(`[merCommand requestErsanUrl] 接口返回失败 code=${response.data.code}, msg=${response.data.msg}`);
      return; // 静默
    }

    const data = response?.data?.data ?? null;
    if (!data || (typeof data !== "object")) return;
    const entries = Array.isArray(data)
      ? data.map((v, i) => [i, v])
      : Object.entries(data);

    const result = entries
      .map(([k, v]) => `${k}: ${v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : v)}`)
      .join("\n");

    return result;
  } catch (err) {
    console.error(`[merCommand-requestErsanUrl-bot]`, err);
    return;
  }
}

module.exports = {
  requestErsanUrl
};
