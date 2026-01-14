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
    console.info(`[requestErsanUrl] = ${merchants}`);
    if (!merchants?.length) {
      console.warn(`[merCommand requestErsanUrl] 找不到 merchantNo, chatId=`, chatId);
      return;
    }

    const isBalanceCommand = /balance/i.test(command.identifier);

    const params = await tgDbService.getParamsByCommandId(command.id) || [];
    const requiredParams = params.filter(p => p.required === 1);
    const effectiveRequiredCount = requiredParams.filter(p => !AUTO_FILLED_PARAMS.has(p.parameter_name)).length;
    if (userArgs.length < effectiveRequiredCount) {
      const missing = requiredParams
        .filter(p => !AUTO_FILLED_PARAMS.has(p.parameter_name))
        .slice(userArgs.length)
        .map(p => p.parameter_name)
        .join("、");

      console.warn(`参数不足，缺少：${missing}`);
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
      const body = { merchantNo };

      // 1. 先处理用户可能传的「命名参数」（如：orderNo=123 amount=500）
      userArgs.forEach(arg => {
        if (typeof arg === 'string' && arg.includes('=')) {
          const [key, ...valParts] = arg.split('=');
          const value = valParts.join('=').trim(); // 支持 value 中包含 = 的情况
          if (key && value) {
            body[key.trim()] = value;
          }
        }
      });

      // 2. 再处理位置参数（传统顺序参数）
      let positionalIndex = 0;
      params.forEach(param => {
        const name = param.parameter_name;
        // 如果已经被命名参数覆盖了，就跳过
        if (body.hasOwnProperty(name)) return;

        // 否则尝试用位置参数填充
        if (positionalIndex < userArgs.length) {
          const arg = userArgs[positionalIndex];
          // 如果这个位置参数看起来是「key=value」形式，就跳过（留给上面处理）
          if (typeof arg === 'string' && arg.includes('=')) {
            // do nothing
          } else {
            body[name] = arg ?? "";
            positionalIndex++;
          }
        }
      });

      return body;
    };

    // === 执行请求 ===
    const doRequest = async (merchantNo) => {
      const body = buildBody(merchantNo);
      let response;
      console.info(`【requestErsanUrl doRequest】${body}`)
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
      return results.join("\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n");
    }

    // ===== 根据商户查询成功率 =====

    const isMchOrderStat =
      /payinRate/i.test(command.identifier) ||
      /\/plt\/order-statistics\/payinRate/i.test(command.url);

    if (isMchOrderStat) {
      const merchantNos = merchants.map(m => m.merchantNo).filter(Boolean);

      const headers = {
        Authorization: `Bearer ${token}`,
        "tenant-id": "1"
      };
      const axiosCfg = { headers, timeout: 15000 };

      let response;
      try {
        response = await axios.post(command.url, { merchantNos }, axiosCfg);
      } catch (e) {
        console.warn(`[merCommand requestErsanUrl] mchOrderStat 请求异常: ${e?.message || e}`);
        return;
      }

      const code = response?.data?.code;
      const msg = response?.data?.msg?.trim?.() || "";
      const rawData = response?.data?.data ?? null;

      if (typeof code !== "undefined" && code !== 0) {
        console.warn(`[merCommand requestErsanUrl] mchOrderStat 接口失败 code=${code}, msg=${msg}`);
        return;
      }

      if (!rawData) return "暂无统计数据";

      const data = normalizeMchOrderStatData(rawData);

      const formatted = await formatResult(command, data);

      const text = String(formatted).trim();
      const blocks = text
        .split(/\n(?=<b>[^<]+<\/b>\n)/g)
        .map(s => s.trim())
        .filter(Boolean);

      const sep = "\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n";
      return blocks.join(sep);
    }

    // ===== 非 balance 命令逻辑 =====
    let hasOrderNotFound = false;

    for (const { merchantNo } of merchants) {
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

function toPercent(val, digits = 2) {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return (n * 100).toFixed(digits);
}

function normalizeMchOrderStatData(data) {
  const mapOne = (item) => ({
    ...item,

    // 5 分钟
    fiveMinuteSuccessCount: item.fiveMinutePayInStat?.successCount ?? 0,
    fiveMinuteTotalCount: item.fiveMinutePayInStat?.totalCount ?? 0,
    fiveMinuteSuccessRate: ((item.fiveMinutePayInStat?.successRate ?? 0) * 100).toFixed(1),

    // 15 分钟
    fifteenMinuteSuccessCount: item.fifteenMinutePayInStat?.successCount ?? 0,
    fifteenMinuteTotalCount: item.fifteenMinutePayInStat?.totalCount ?? 0,
    fifteenMinuteSuccessRate: ((item.fifteenMinutePayInStat?.successRate ?? 0) * 100).toFixed(1),

    // 30 分钟
    thirtyMinuteSuccessCount: item.thirtyMinutePayInStat?.successCount ?? 0,
    thirtyMinuteTotalCount: item.thirtyMinutePayInStat?.totalCount ?? 0,
    thirtyMinuteSuccessRate: ((item.thirtyMinutePayInStat?.successRate ?? 0) * 100).toFixed(1),

    // 60 分钟
    sixtyMinuteSuccessCount: item.sixtyMinutePayInStat?.successCount ?? 0,
    sixtyMinuteTotalCount: item.sixtyMinutePayInStat?.totalCount ?? 0,
    sixtyMinuteSuccessRate: ((item.sixtyMinutePayInStat?.successRate ?? 0) * 100).toFixed(1),

    // 全天
    allDaySuccessCount: item.allDayPayInStat?.successCount ?? 0,
    allDayTotalCount: item.allDayPayInStat?.totalCount ?? 0,
    allDaySuccessRate: ((item.allDayPayInStat?.successRate ?? 0) * 100).toFixed(1),
  });

  return Array.isArray(data) ? data.map(mapOne) : mapOne(data);
}

module.exports = {
  requestErsanUrl
};
