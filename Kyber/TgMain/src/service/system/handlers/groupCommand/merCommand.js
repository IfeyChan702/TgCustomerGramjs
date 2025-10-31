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
      console.warn(`[merCommand requestErsanUrl] 找不到chatId, chatId=`, chatId);
      return;
    }

    const merchants = await sysMerchantChatService.getMerchantNoByChatId(String(chatId));
    if (!merchants?.length) {
      console.warn(`[merCommand requestErsanUrl] 找不到 merchantNo, chatId=`, chatId);
      return;
    }

    const isBalanceCommand = /balance/i.test(command.identifier);

    const params = await tgDbService.getParamsByCommandId(command.id) || [];
    const requiredParams = params.filter(p => p.required === 1);
    const effectiveRequiredCount = requiredParams.filter(p => !AUTO_FILLED_PARAMS.has(p.parameter_name)).length;
    if (userArgs.length < effectiveRequiredCount) {
      console.warn(`参数不足，至少需要 ${effectiveRequiredCount} 个参数`);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "tenant-id": "1"
    };
    const method = String(command.method || "GET").toUpperCase();
    const axiosCfg = { headers, timeout: 15000 };

    // === 构造 body ===
    const buildBody = (merchantNo) => {
      const body = {};
      const argCount = Math.min(userArgs.length, params.length);
      for (let i = 0; i < argCount; i++) {
        const name = params[i].parameter_name;
        body[name] = userArgs[i] ?? "";
      }
      body.merchantNo = merchantNo;
      return body;
    };

    // === 执行请求 ===
    const doRequest = async (merchantNo) => {
      const body = buildBody(merchantNo);
      let response;

      try {
        if (method === "GET") {
          response = await axios.get(command.url, { ...axiosCfg, params: body });
        } else {
          response = await axios.post(command.url, body, axiosCfg);
        }
      } catch (e) {
        console.warn(`[merCommand requestErsanUrl] 商户 ${merchantNo} 请求异常: ${e?.message || e}`);
        return { result: null, orderNotFound: false };
      }

      const code = response?.data?.code;
      const msg = response?.data?.msg?.trim?.() || "";
      const data = response?.data?.data ?? null;

      // 接口返回失败
      if (typeof code !== "undefined" && code !== 0) {
        console.warn(`[merCommand requestErsanUrl] 商户 ${merchantNo} 接口失败 code=${code}, msg=${msg}`);
        if (msg.includes("订单不存在")) {
          return { result: null, orderNotFound: true };
        }
        return { result: null, orderNotFound: false };
      }

      // 没有 data
      if (!data) {
        console.warn(`[merCommand requestErsanUrl] 商户 ${merchantNo} 返回空数据`);
        return { result: null, orderNotFound: false };
      }

      const formatted = await formatResult(command, data);
      const orderNotFound = formatted?.includes("订单不存在");
      return { result: formatted, orderNotFound };
    };

    // ===== balance 命令：对所有商户调用并拼接 =====
    if (isBalanceCommand) {
      const results = [];
      for (const { merchantNo, merchantName } of merchants) {
        const { result, orderNotFound } = await doRequest(merchantNo);
        if (result) {
          results.push(`商户 ${merchantName}：\n${result}`);
        } else if (orderNotFound) {
          results.push(`商户 ${merchantName}：订单不存在`);
        } else {
          console.warn(`商户 ${merchantName}(${merchantNo}) 未查到数据`);
        }
      }
      if (!results.length) {
        console.warn("[merCommand requestErsanUrl] 所有商户都未查到数据");
        return;
      }
      return results.join("\n\n------------------\n\n");
    }

    // ===== 非 balance 命令逻辑 =====
    let hasOrderNotFound = false;

    for (const merchantNo of merchantNos) {
      const { result, orderNotFound } = await doRequest(merchantNo);

      if (orderNotFound) hasOrderNotFound = true;

      if (result && !orderNotFound && result.trim() !== "") {
        // 查到有效内容立即返回
        return result;
      }
    }

    // 如果所有都没有结果，但有一个返回“订单不存在”
    if (hasOrderNotFound) return "订单不存在";

    // 都没结果
    return;

  } catch (err) {
    console.error(`[merCommand-requestErsanUrl-bot]`, err);
  }
}

// === 格式化逻辑保持不变 ===
async function formatResult(command, data) {
  const formatCfg = await tgComFormatService.getFormatByCommandId(command.id);
  let result = "";

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
        .replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "")
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "");
    } else {
      result = JSON.stringify(data, null, 2);
    }
  }

  return result;
}

module.exports = {
  requestErsanUrl
};
