const tgDbService = require("../../../../service/tgDbService");
const tgComFormatService = require("../../../command/tgComFormatService");
const axios = require("axios");
const { getErsanToken } = require("../../../../service/handle/handleOrder");
const sysMerchantChatService = require("../../../../service/system/sysMerchantChatService");
const { redis } = require("../../../../models/redisModel");


const AUTO_FILLED_PARAMS = new Set(["merchantNo"]);

const batchFormatters = {
  withdrawstat: (data, command, userArgs, params = []) => {
    let timeSpanArg =
      userArgs.find(a => a.startsWith("timeSpan="))?.split("=")[1] ||
      userArgs.find(a => a.startsWith("minutes="))?.split("=")[1];

    if (!timeSpanArg) {
      const idx = params.findIndex(p => p.parameter_name === "timeSpan");
      if (idx >= 0 && userArgs[idx] && !userArgs[idx].includes("=")) {
        timeSpanArg = userArgs[idx];
      }
    }

    const timeSpan = Number(timeSpanArg ?? command?.default_timeSpan ?? 10);
    data.timeSpan = Number.isFinite(timeSpan) ? timeSpan : 10;

    // 🔥 格式化 withdrawOrderList 为明细列表
    if (Array.isArray(data.withdrawOrderList) && data.withdrawOrderList.length > 0) {
      data.withdrawList = data.withdrawOrderList
        .map((item, idx) =>
          `<b>${idx + 1}.</b> 订单号：<code>${item.no}</code>\n` +
          `    💵 实付金额：${item.paymentCyptoAmount} ${item.currency}\n` +
          `    💱 汇率：${item.usdtRate}\n` +
          `    💰 USDT：${item.applyCryptoAmount}`
        )
        .join("\n\n");
    } else {
      data.withdrawList = "🔍 <i>暂无提现记录</i>";
    }

    return data;
  }
};

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
    const isBatch = command.execute_mode === "batch";
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
    const buildBody = (merchantNoOrNos) => {
      const body = {};

      //1.默认参数
      params.forEach(p => {
        if (p.parameter_value !== null && p.parameter_value !== undefined) {
          body[p.parameter_name] = p.parameter_value;
        }
      });
      // 2. 用户覆盖参数
      // 处理位置参数
      //TODO 这个之后需要更改
      const firstArg = userArgs[0];
      if (firstArg && !isNaN(Number(firstArg))) {
        body.timeSpan = Number(firstArg);
      }

      // 处理 key=value 参数（兼容其他参数）
      userArgs.forEach(arg => {
        if (typeof arg === "string" && arg.includes("=")) {
          const [k, ...v] = arg.split("=");
          body[k.trim()] = v.join("=").trim();
        }
      });

      //3.自动商户参数
      if (Array.isArray(merchantNoOrNos)) {
        body.merchantNos = merchantNoOrNos;
      } else {
        body.merchantNo = merchantNoOrNos;
      }

      return body;
    };

    //如果是批量商户调一个接口
    if (isBatch) {
      const merchantNos = merchants.map(m => m.merchantNo).filter(Boolean);
      const body = buildBody(merchantNos);

      let resp;
      try {
        resp = await axios({
          url: command.url,
          method,
          data: body,
          ...axiosCfg
        });
      } catch (e) {
        console.warn(`[batch command error]`, e?.message);
        return;
      }

      if (resp?.data?.code !== 0) return;

      let data = resp.data.data;

      // 只对特定命令做格式化
      const formatter = batchFormatters[command.identifier];
      if (formatter) {
        data = formatter(data, command, userArgs, params);
      }

      return await formatResult(command, data);
    }

    // === 执行请求(sing 模式) ===
    const doRequest = async (merchantNo) => {
      const body = buildBody(merchantNo);
      let response;
      console.info(`【requestErsanUrl doRequest】${body}`);
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
      const escapeHtml = (s = "") =>
        String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      for (const { merchantNo, merchantName } of merchants) {
        const name = escapeHtml(merchantName);
        const { result, orderNotFound } = await doRequest(merchantNo);
        if (result) {
          results.push(`<b>${name}</b>\n${result}`);
        } else if (orderNotFound) {
          results.push(`<b>${name}</b>\n订单不存在`);
        } else {
          results.push(`<b>${name}</b>\n暂无数据`);
          console.warn(`[balance] 商户 ${merchantName}(${merchantNo}) 未查到数据`);
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
    allDaySuccessRate: ((item.allDayPayInStat?.successRate ?? 0) * 100).toFixed(1)
  });

  return Array.isArray(data) ? data.map(mapOne) : mapOne(data);
}

module.exports = {
  requestErsanUrl
};
