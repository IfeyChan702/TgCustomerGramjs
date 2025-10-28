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
      console.warn(`参数不足，至少需要 ${effectiveRequiredCount} 个参数`);
      return;
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
    console.info(`[merCommand requestErsanUrl] 调用接口 code=${response.data.code}, msg=${response.data.msg}`);
    if (typeof response?.data?.code !== "undefined" && response.data.code !== 0) {
      console.warn(`[merCommand requestErsanUrl] 接口返回失败 code=${response.data.code}, msg=${response.data.msg}`);
      const msg = response.data.msg?.trim() || "";
      if (msg.includes('订单不存在')) return msg;
      return;
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
      if (formatCfg?.format_template) {
        result = data.map(item =>
          formatCfg.format_template
            .replace(/\{(\w+)\}/g, (_, key) => (item[key] ?? ""))
            .replace(/\\n/g, "\n")
            .replace(/\r/g, "")
        ).join("\n\n");
      } else {
        const keys = Object.keys(data[0] || {});
        const header = keys.join(" | ");
        const lines = data.map(row => keys.map(k => row[k] ?? "").join(" | "));
        result = [header, ...lines].join("\n");
      }
    } else if (typeof data === "object") {
      if (formatCfg?.format_template) {
        result = formatCfg.format_template
          .replace(/\{(\w+)\}/g, (_, key) => {
            const val = data[key];
            return (val !== undefined && val !== null) ? val : "";
          })
          .replace(/\\n/g, "\n")
          .replace(/\r/g, "");
      } else {
        result = JSON.stringify(data, null, 2);
      }
    }

    if ((!result || result.trim() === "") && formatCfg && formatCfg.format_type) {
      switch (formatCfg.format_type) {
        case "json":
          result = JSON.stringify(data, null, 2);
          break;

        case "text":
          if (formatCfg.format_template)
            result = formatCfg.format_template
              .replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "")
              .replace(/\\n/g, "\n")
              .replace(/\r/g, "");
          else
            result = JSON.stringify(data, null, 2);
          break;

        case "table":
          if (Array.isArray(data)) {
            const keys = Object.keys(data[0] || {});
            const header = keys.join(" | ");
            const lines = data.map(row => keys.map(k => row[k] ?? "").join(" | "));
            result = [header, ...lines].join("\n");
          } else {
            result = JSON.stringify(data, null, 2);
          }
          break;

        case "custom":
          // 可根据需求扩展 markdown/html
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
