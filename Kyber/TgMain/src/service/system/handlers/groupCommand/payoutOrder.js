const tgDbService = require("../../../../service/tgDbService");
const axios = require("axios");
const { getErsanToken } = require("../../../../service/handle/handleOrder")
const { redis } = require("../../../../models/redisModel");

const ERSAN_TOKEN_KEY = "ersan:accessToken";

async function requestErsanUrl( command, userArgs) {
  try {
    const token = await getErsanToken(redis);

    const params = await tgDbService.getParamsByCommandId(command.id);
    const requiredParams = params.filter(p => p.required === 1);
    if (userArgs.length < requiredParams.length) {
      return `⚠️ 参数不足，至少需要 ${requiredParams.length} 个参数`;
    }
    const body = {};
    for (let i = 0; i < params.length; i++) {
      const paramName = params[i].parameter_name;
      const userValue = userArgs[i] ?? ""; // 避免把 0/false 变成空串
      body[paramName] = userValue;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "tenant-id": "1",
    };

    const method = String(command.method || "GET").toUpperCase();
    let response;
    if (method === "GET") {
      response = await axios.get(command.url, { params: body, headers });
    } else {
      response = await axios.post(command.url, body, { headers });
    }

    const data = response.data.data;
    const result = Object.entries(data)
      .map(([key, value]) => `${key}: ${value ?? ""}`)
      .join("\n");

    return result;
  }catch (err){
    console.error(`[requestErsanUrl-Bot]`,err)
    return "❌ 系统繁忙，请稍后重试！";
  }
}

module.exports = {
  requestErsanUrl,
};
