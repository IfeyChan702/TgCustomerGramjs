// handle/orderQueryService.js
// UTR 代收查单：调用 order-in/get 查单 + 统一卡片格式化
const axios = require("axios");
const { redis } = require("../../models/redisModel");
const { getErsanToken } = require("./handleOrder");

// 平台收款订单查询接口（返回 orderNo/merchantOrderNo/utr/amount/createTime/status 等）
// 生产默认 gamecloud；测试环境用 .env 的 PLT_API_BASE 覆盖，如 https://api.pay.ersan.click
const PLT_API_BASE = process.env.PLT_API_BASE || "https://api.gamecloud.vip";
const ORDER_DETAIL_URL = `${PLT_API_BASE}/admin-api/plt/order-in/get`;

// 订单状态码：0-创建成功 10-待收款 11-收款成功 12-分润完成
//            20-待付款 21-付款成功 22-分润完成 23-付款失败 30-已取消
const SUCCESS_STATUS = new Set([11, 12]);
const FAIL_STATUS = new Set([23, 30]);

function isSuccess(status) {
  return SUCCESS_STATUS.has(Number(status));
}
function isTerminalFail(status) {
  return FAIL_STATUS.has(Number(status));
}
// 既非成功也非终态失败（如 0 创建成功 / 10 待收款）→ 未支付，走重查
function isPending(status) {
  return !isSuccess(status) && !isTerminalFail(status);
}

/**
 * 调用 order-in/get 查单，返回归一化后的订单详情
 * @param {string} orderNo 平台单号/商户单号/渠道单号
 * @returns {Promise<null | {orderNo,merchantOrderNo,channelOrderNo,channelId,channelName,status,statusDesc,utr,amount,createTime}>}
 */
async function queryOrderDetail(orderNo) {
  try {
    const token = await getErsanToken(redis);
    if (!token) {
      console.warn("[queryOrderDetail] 无可用 token");
      return null;
    }
    const resp = await axios.get(`${ORDER_DETAIL_URL}/${orderNo}`, {
      headers: { "tenant-id": "1", Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    const body = resp.data || {};
    if (body.code !== 0 || !body.data) {
      console.warn(`[queryOrderDetail] 接口异常 order=${orderNo} resp=${JSON.stringify(body)}`);
      return null;
    }
    const d = body.data;
    return {
      orderNo: d.orderNo || "",
      merchantOrderNo: d.merchantOrderNo || "",
      channelOrderNo: d.channelOrderNo || "",
      channelId: d.channelId,
      channelName: d.channelName || "",
      status: Number(d.status),
      statusDesc: d.statusDesc,
      utr: d.utr || "",
      amount: d.amount,
      createTime: d.createTime || "",
    };
  } catch (err) {
    console.error(`[queryOrderDetail] 请求失败 order=${orderNo}: ${err.message}`);
    return null;
  }
}

// ------------- 格式化辅助 -------------
function fmtAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toFixed(2) : (amount ?? "");
}

// 解析 createTime 为毫秒时间戳（接口可能返回 epoch秒/毫秒 或 日期字符串）
function toEpochMs(t) {
  if (t == null || t === "") return NaN;
  if (t instanceof Date) return t.getTime();   // MySQL 驱动可能把 DATETIME 返回成 Date 对象
  const str = String(t).trim();
  if (typeof t === "number" || /^\d{10,13}$/.test(str)) {
    let ms = Number(str);
    if (str.length <= 10) ms *= 1000; // 秒 → 毫秒
    return ms;
  }
  return new Date(str.replace("T", " ").replace(" ", "T")).getTime();
}

// 输出 YYYY-MM-DD HH:mm:ss（兼容数字时间戳和日期字符串）
function fmtTime(t) {
  if (t == null || t === "") return "";
  const ms = toEpochMs(t);
  if (Number.isFinite(ms)) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  const s = String(t).replace("T", " ");
  const m = s.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  return m ? m[1] : s;
}

/**
 * ① 处理中卡片（商户查单后立即回）
 */
function buildQueryingCard(detail, submittedOrderNo) {
  return [
    "UTR代收查单",
    `商户订单号：${detail.merchantOrderNo || submittedOrderNo || ""}`,
    `平台订单号：${detail.orderNo || ""}`,
    `订单创建时间：${fmtTime(detail.createTime)}`,
    `订单金额：${fmtAmount(detail.amount)}`,
    "工单状态：处理中",
  ].join("\n");
}

/**
 * ②③⑤ 补单结果卡片
 * @param {object} p
 * @param {object} p.detail       接口返回的订单详情
 * @param {string} p.submittedOrderNo 商户提交的订单号
 * @param {boolean} p.success     是否查单成功
 * @param {string} p.note         说明（语料库话术）
 * @param {string} [p.matchedOrderNo] UTR匹配到的真实商户单号（③不一致时才传，当前流程不传→不展示）
 */
function buildResultCard({ detail, submittedOrderNo, success, note, matchedOrderNo }) {
  const lines = [
    "UTR补单结果",
    `订单号：${submittedOrderNo || detail.merchantOrderNo || ""}`,
    `平台订单号：${detail.orderNo || ""}`,
    `订单创建时间：${fmtTime(detail.createTime)}`,
    `订单金额：${fmtAmount(detail.amount)}`,
    `UTR：${detail.utr || ""}`,
    `结果：${success ? "查单成功" : "查单失败"}`,
  ];
  // 匹配订单号：仅当显式传入 matchedOrderNo 且与提交单号不一致时展示（③，当前流程不传→不显示）
  if (matchedOrderNo && submittedOrderNo && matchedOrderNo !== submittedOrderNo) {
    lines.push(`匹配订单号：${matchedOrderNo}`);
  }
  if (note) lines.push(`说明：${note}`);
  lines.push("工单状态：已完成");
  return lines.join("\n");
}

module.exports = {
  queryOrderDetail,
  isSuccess,
  isTerminalFail,
  isPending,
  buildQueryingCard,
  buildResultCard,
  fmtTime,
  fmtAmount,
  toEpochMs,
};
