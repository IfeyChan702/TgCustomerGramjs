// ui/templates.js
const { Markup } = require("telegraf");
const { sign } = require("../system/security");

function approveKeyboard(orderId, merchantNo) {
  const ok = `ok|${orderId}|${merchantNo}|${sign(`ok|${orderId}|${merchantNo}`)}`;
  const no = `no|${orderId}|${merchantNo}|${sign(`no|${orderId}|${merchantNo}`)}`;
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ 同意", ok), Markup.button.callback("❌ 拒绝", no)]
  ]);
}

function auditKeyboard(
  orderId,
  merchantNo,
  merchantName,
  currency,
  amount,
  balanceAvailable,
  usdtAddress,
  addressHint,
  exchangeRate,
  usdtFinal,
  isSameAddress = true,
  optType
) {
  const okAudit = `okAudit|${orderId}|${merchantNo}|${merchantName}|${currency}|${amount}|${balanceAvailable}|${usdtAddress}|${addressHint}|${exchangeRate}|${usdtFinal}|${isSameAddress}|${optType}|${sign(`okAudit|${orderId}|${merchantNo}`)}`;
  const noAudit = `noAudit|${orderId}|${merchantNo}|${merchantName}|${currency}|${amount}|${balanceAvailable}|${usdtAddress}|${addressHint}|${exchangeRate}|${usdtFinal}|${isSameAddress}|${optType}|${sign(`noAudit|${orderId}|${merchantNo}`)}`;
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ 确认", okAudit), Markup.button.callback("❌ 拒绝", noAudit)]
  ]);
}

function formatWithdrawCard({
                              orderId,
                              merchantName,
                              currency,
                              applyTime,
                              amount,
                              balanceAvailable,
                              usdtAddress,
                              addressHint,
                              exchangeRate,
                              usdtFinal,
                              isSameAddress = true,
                              optType
                            }) {
  const confirmText = isSameAddress
    ? "请一位老板确认回U地址及申请"
    : "⚠️ 回U地址与上次不一致，请两位老板确认！";

  const usdtAmountLine = `${amount} / ${exchangeRate} = ${usdtFinal}`;

  let text =
    `提 现 申 请\n` +
    `订单号: <code>${orderId}</code>\n` +
    `商户名: <code>${merchantName}</code>\n` +
    `申请货币: <b>${currency}</b>\n` +
    `申请时间: <code>${applyTime}</code>\n` +
    `可用金额: <b>${balanceAvailable}</b>\n` +
    `申请金额: <b>${amount}</b>\n`;

  if (Number(optType) === 1) {
    text += `回U地址: ❤️${usdtAddress}❤️\n`;
    if (addressHint) text += `回U提示: ❤️${addressHint}❤️\n`;
    text += `回U数量: ${usdtAmountLine}\n`;
  }

  text += confirmText;

  return text;
}

function approvedSuffix(ts) {
  return `\n\n✅ 提现申请已确认,请稍等! \n时间：${ts}`;
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
  approvedSuffix,
  waitingReasonSuffix,
  rejectedFinal,
  formatWithdrawCard,
  auditKeyboard
};
