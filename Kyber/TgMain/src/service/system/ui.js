// ui/templates.js
const { Markup } = require("telegraf");
const { sign } = require("../system/security");

function approveKeyboard(orderId, merchantNo, type) {//type(0是提现，1:加款、2：扣款、3投诉)
  // 确保 sign 函数正常
  const okSig = sign ? sign(`ok|${orderId}|${merchantNo}`) : "dummy";
  const noSig = sign ? sign(`no|${orderId}|${merchantNo}`) : "dummy";

  const ok = `ok|${orderId}|${merchantNo}|${type}|${okSig}`;
  const no = `no|${orderId}|${merchantNo}|${type}|${noSig}`;

  console.log("[DEBUG] approveKeyboard 返回:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "同意", callback_data: ok },
          { text: "拒绝", callback_data: no }
        ]
      ]
    }
  });

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "同意", callback_data: ok },
          { text: "拒绝", callback_data: no }
        ]
      ]
    }
  };
}

function auditKeyboard(orderId, merchantNo) {
  const okAudit = `okAudit|${orderId}|${merchantNo}|${sign(`okAudit|${orderId}|${merchantNo}`)}`;
  const noAudit = `noAudit|${orderId}|${merchantNo}|${sign(`noAudit|${orderId}|${merchantNo}`)}`;
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
                              optType,
                              isConfirmInfo = true
                            }) {

  let confirmText;
  if (isConfirmInfo) {
    confirmText = "\n请审核提现订单是否正确";
  } else {
    confirmText = isSameAddress
      ? "\n请老板确认回U地址及申请"
      : "\n⚠️ 回U地址与上次不一致，请老板确认！";
  }


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

function formatOrderCard({
                           orderId,
                           merchantName,
                           optType,           // freeze | rebate | adjust
                           amount,
                           currency,
                           balanceBefore,
                           balanceAfter,
                           remark = "",
                           applyTime,
                           operator,
                           accountNo,
                           channelName
                         }) {
  const OPT = {
    1: { title: "加款" },
    2: { title: "扣款" },
    3: { title: "投诉" }
  };

  const config = OPT[optType] || OPT.adjust;
  const remarkLine = remark ? `\n<strong>备注：</strong> ${remark}` : "";

  let channelLine = "";
  if (optType === 3 && channelName) {
    channelLine = `<strong>投诉渠道：</strong> <code>${channelName}</code>\n`;
  }

  return `<b>${config.title}</b>\n\n` +
    `<strong>订单号：</strong> <code>${orderId}</code>\n` +
    `<strong>商户：</strong> <code>${merchantName}</code>\n` +
    `<strong>账户号：</strong> <code>${accountNo}</code>\n` +
    channelLine +
    `<strong>操作人：</strong> <code>${operator}</code>\n` +
    `<strong>时间：</strong> <code>${applyTime}</code>\n\n` +
    `<strong>金额：</strong> <b>${amount}</b> ${currency}\n` +
    `<strong>操作前：</strong> <b>${balanceBefore}</b> ${currency}\n` +
    `<strong>操作后：</strong> <b>${balanceAfter}</b> ${currency}\n` +
    `${remarkLine}`;
}

function formatInternalRequestCard({ orderId, amount, currency, applyTime, operator, remark }) {
  return [
    `💼 <b>内部请款</b>`,
    `────────────────────`,
    `🧾 单号：<code>${orderId}</code>`,
    `💵 金额：<b>${amount} ${currency}</b>`,
    `🕒 申请时间：${applyTime}`,
    `👤 申请人：${operator}`,
    remark ? `📝 备注：${remark}` : null
  ].filter(Boolean).join("\n");
}

/**
 * 格式化批量转账订单卡片
 */
function formatBatchTransferCard({
                                   orderId,
                                   merchantName,
                                   accountNo,
                                   amount,
                                   currency,
                                   balanceBefore,
                                   balanceAfter,
                                   applyTime,
                                   operator,
                                   remark = "",
                                   detailList = [], // 子订单列表
                                   detailItemCount
                                 }) {
  const MAX_DISPLAY = 5; // 最多显示5条
  const transferCount = detailList.length;

  const remarkLine = remark ? `\n<strong>备注：</strong> ${remark}` : "";

  // 构建子订单明细
  let detailText = "";
  if (detailList.length > 0) {
    detailText += "\n\n<b>━━━━ 转账明细 ━━━━</b>\n";

    const displayList = detailList.slice(0, MAX_DISPLAY);
    displayList.forEach((detail, index) => {
      detailText += `\n<b>${index + 1}. ${detail.payeeUserName}</b>\n`;
      detailText += `   账号: <code>${detail.payeeAccount}</code>\n`;
      detailText += `   IFSC: <code>${detail.payeeIfsc}</code>\n`;
      detailText += `   金额: <b>${detail.transferAmount} ${currency}</b>\n`;
    });

    if (transferCount > MAX_DISPLAY) {
      detailText += `\n<i>...还有 ${transferCount - MAX_DISPLAY} 笔转账</i>\n`;
    }
  }

  return `<b>💸 批量转账申请</b>\n\n` +
    `<strong>订单号：</strong> <code>${orderId}</code>\n` +
    `<strong>商户：</strong> <code>${merchantName}</code>\n` +
    `<strong>账户号：</strong> <code>${accountNo}</code>\n` +
    `<strong>操作人：</strong> <code>${operator}</code>\n` +
    `<strong>时间：</strong> <code>${applyTime}</code>\n\n` +
    `<strong>转账笔数：</strong> <b>${detailItemCount}</b> 笔\n` +
    `<strong>总金额：</strong> <b>${amount} ${currency}</b>\n` +
    `<strong>操作前余额：</strong> <b>${balanceBefore} ${currency}</b>\n` +
    `<strong>操作后余额：</strong> <b>${balanceAfter} ${currency}</b>\n` +
    `${remarkLine}` +
    `${detailText}`;
}

function approvedSuffix(ts) {
  return `\n\n✅ 订单已确认,请稍等! \n时间：${ts}`;
}

function waitingReasonSuffix() {
  return `\n\n⌛ 等待私聊提交拒绝理由…`;
}

function rejectedFinal(username, ts) {
  return (
    `❌ 已拒绝`
  );
}

async function sendApproveKeyboard(ctx, state) {
  const kb = state.admins.map(a => ([{
    text: `${a.selected ? "✅" : "☐"} ${a.name}`,
    callback_data: `toggle:${a.id}`
  }]));

  kb.push([{ text: "确认创建", callback_data: "approve:confirm" }]);
  await ctx.reply("请选择审批人：", { reply_markup: { inline_keyboard: kb } });
}

async function editApproveKeyboard(ctx, state) {
  const kb = state.admins.map(a => ([{
    text: `${a.selected ? "✅" : "☐"} ${a.name}`,
    callback_data: `toggle:${a.id}`
  }]));

  kb.push([{ text: "确认创建", callback_data: "approve:confirm" }]);
  await ctx.editMessageReplyMarkup({ inline_keyboard: kb });
}


async function sendApproveSummary(ctx, state) {
  const list = state.approveCandidates.length
    ? state.approveCandidates.map(id => `- ${id}`).join("\n")
    : "（暂无）";

  await ctx.reply(
    `当前审批人 ${state.approveCandidates.length} / ${state.expectedApproveCount}\n` +
    list,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "使用当前审批人", callback_data: "approve:use_current" }],
          [{ text: "继续等待", callback_data: "approve:wait_more" }]
        ]
      }
    }
  );
}

module.exports = {
  approveKeyboard,
  approvedSuffix,
  waitingReasonSuffix,
  editApproveKeyboard,
  sendApproveKeyboard,
  rejectedFinal,
  sendApproveSummary,
  formatWithdrawCard,
  auditKeyboard,
  formatOrderCard,
  formatInternalRequestCard,
  formatBatchTransferCard
};
