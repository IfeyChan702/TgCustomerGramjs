const tgDbService = require("../../../../service/tgDbService");
const tgComFormatService = require("../../../command/tgComFormatService")
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
    const effectiveRequiredCount = requiredParams.filter(p => !AUTO_FILLED_PARAMS.has(p.parameter_name)).length;
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
      return response.data.msg || "请求失败";
    }

    const data = response?.data?.data ?? null;
    if (!data) {
      console.warn(`[merCommand requestErsanUrl] 接口没有返回数据 code=${response.data.code}, msg=${response.data.msg}`);
      return;
    }

    // ======= 新增：获取格式化配置 =======
    const formatCfg = await tgComFormatService.getFormatByCommandId(command.id);
    let result = "";

    // ======= 根据数据类型自动处理 =======
    if (Array.isArray(data)) {
      // 数组：输出为表格
      const keys = Object.keys(data[0] || {});
      const header = keys.join(" | ");
      const lines = data.map(row => keys.map(k => row[k] ?? "").join(" | "));
      result = [header, ...lines].join("\n");
    } else if (typeof data === "object") {
      // 对象：使用模板或 JSON
      if (formatCfg?.format_template) {
        result = formatCfg.format_template
          .replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "")
          .replace(/\\n/g, "\n");
      } else {
        result = JSON.stringify(data, null, 2);
      }
    } else {
      result = String(data);
    }

    // ======= 应用数据库配置的格式类型 =======
    if (formatCfg && formatCfg.format_type) {
      switch (formatCfg.format_type) {
        case "json":
          result = JSON.stringify(data, null, 2);
          break;
        case "text":
          if (formatCfg.format_template)
            result = formatCfg.format_template
              .replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "")
              .replace(/\\n/g, "\n");;
          break;
        case "table":
          // 已自动处理
          break;
        case "custom":
          // 可自行扩展 markdown 或 html
          result = JSON.stringify(data, null, 2);
          break;
      }
    }

    return result;
  } catch (err) {
    console.error(`[merCommand-requestErsanUrl-bot]`, err);
  }
}

module.exports = {
  requestErsanUrl
};
