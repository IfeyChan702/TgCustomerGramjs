// ui/templates.js
const { Markup } = require("telegraf");
const { sign } = require("../system/security");

function approveKeyboard(orderId, merchantId) {
  const ok = `ok|${orderId}|${merchantId}|${sign(`ok|${orderId}|${merchantId}`)}`;
  const no = `no|${orderId}|${merchantId}|${sign(`no|${orderId}|${merchantId}`)}`;
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ 同意", ok), Markup.button.callback("❌ 拒绝", no)]
  ]);
}

function formatCard(orderId, amount, userDisplay) {
  return (
    `💸 <b>提现审核</b>\n` +
    `订单号：<code>${orderId}</code>\n` +
    `用户：${userDisplay}\n` +
    `金额：${amount}\n\n` +
    `请审核人确认。`
  );
}

function formatWithdrawCard({ orderId, amount, exchangeRate, remark, merchantId, currency }) {
  // 按需做一个简单换算展示（不改变业务值）
  let converted = "";
  const amt = Number(amount);
  const rate = Number(exchangeRate);
  if (!Number.isNaN(amt) && !Number.isNaN(rate)) {
    const val = (amt * rate).toFixed(2);
    converted = `（按汇率换算：${amount} × ${exchangeRate} = <b>${val}</b>）`;
  }
  return (
    `💸 <b>提现审核</b>\n` +
    `商户：<code>${merchantId}</code>\n` +
    `订单号：<code>${orderId}</code>\n` +
    `金额：<b>${amount}</b> ${converted}\n` +
    `货币：<b>${currency}</b>\n` +
    `汇率：<code>${exchangeRate}</code>\n` +
    (remark ? `备注：${remark}\n` : "") +
    `\n请审核人确认。`
  );
}

function approvedSuffix(username, ts) {
  return `\n\n✅ 已同意\n审核人：@${username}\n时间：${ts}`;
}

function waitingReasonSuffix() {
  return `\n\n⌛ 等待私聊提交拒绝理由…`;
}

function rejectedFinal(username, ts) {
  return (
    `❌ 已拒绝`
  );
}

module.exports = {
  approveKeyboard,
  formatCard,
  approvedSuffix,
  waitingReasonSuffix,
  rejectedFinal,
  formatWithdrawCard
};
