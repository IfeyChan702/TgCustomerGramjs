// handlers/callbacks.js
const { verify } = require("../security");
const { callbackBackend, callbackAppStatus,callbackAccountStatus } = require("../backend");
const { tryDecide, isDecided, isReviewer, getStageStatus, saveStageStatus, isApprover,ensureOrderKeys } = require("../reviewStore");
const { approvedSuffix, approveKeyboard, formatWithdrawCard, auditKeyboard } = require("../ui");
const sysWithdrawContextService = require("../sysWithdrawContextService")
const merChatService = require("../sysMerchantChatService");
const { onMerchantCallback } = require("./merchantWizardHandler");

function registerCallbackHandler(bot) {
  bot.on("callback_query", async (ctx) => {
    const traceId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const log = (...args) => console.log(`[CB ${traceId}]`, ...args);
    const warn = (...args) => console.warn(`[CB ${traceId}]`, ...args);
    const errl = (...args) => console.error(`[CB ${traceId}]`, ...args);

    try {
      const cq = ctx.callbackQuery;
      log("incoming callback_query", { hasCq: !!cq, data: cq?.data });
      if (!cq || typeof cq.data !== "string" || cq.data.length === 0) {
        warn("invalid callback: missing data");
        try {
          await ctx.answerCbQuery("系统繁忙", { show_alert: true });
        } catch (e) {
          warn("answerCbQuery failed (missing data)", e?.message || e);
        }
        return;
      }
      if (cq.data.startsWith("merchant:") || cq.data.startsWith("toggle:") || cq.data.startsWith("approve:")) {
        await onMerchantCallback(ctx);
        return;
      }
      const parts = cq.data.split("|");
      log("parsed parts", { partsLen: parts.length, parts });
      const action = parts[0];
      const orderId = parts[1];
      const merchantNo = parts[2];
      const sig = parts[parts.length - 1];
      const msg = cq.message;

      const approver = ctx.from.username || ctx.from.first_name || String(ctx.from.id);
      const ts = new Date().toLocaleString();
      const approverId = ctx.from.id;

      if (parts.length < 4) {
        errl("callback_data 格式不完整", cq.data);
      }
      log("base fields", { action, orderId, merchantNo, ts, approverId, approver });
      if (!/^M\d{14,30}$/.test(merchantNo)) {
        warn("merchantNo invalid", merchantNo);
        return;
      }

      if (!verify(action, orderId, merchantNo, sig)) {
        warn("签名校验失败");
        return;
      }

      try {
        const chatInfo = await merChatService.getChatInfoByMerchant(merchantNo);
        if (chatInfo?.chatId) {
          if (!chatInfo.reviewerIds.length && !chatInfo.approveIds.length) {
            warn("merchant chat has no reviewers or approvers", { merchantNo });
          }
          await ensureOrderKeys(orderId, {
            reviewerIds: chatInfo.reviewerIds || [],
            approverIds: chatInfo.approveIds || [],
            needAudit: 1,
            needApprove: 1
          });
        } else {
          warn("merchant chat config missing", { merchantNo });
        }
      } catch (e) {
        warn("ensureOrderKeys failed", e?.message || e);
      }

      if (action === "okAudit") {
        log("enter okAudit branch================");

        /*if (!(await isReviewer(orderId, ctx.from.id))) {
          console.warn("没有审核权限,telegramId:",ctx.from.id);
          return await ctx.answerCbQuery("你没有审核权限", { show_alert: true });
        }*/

        log("getWithdrawInfo start", { orderId, merchantNo });
        const info = await getWithdrawInfo(orderId, merchantNo);
        log("getWithdrawInfo result", { found: !!info });

        if (!info) {
          return await ctx.answerCbQuery("未找到提现记录，请联系相关人员", { show_alert: true });
        }
        const {
          merchantName,
          currency,
          amount,
          balanceAvailable,
          usdtAddress,
          addressHint,
          exchangeRate,
          usdtFinal,
          isSameAddress,
          optType,
          applyTime
        } = info;

        log("callbackAppStatus start", { orderId, approver, status: 1 });
        const ok = await callbackAppStatus(orderId, approver, 1);
        log("callbackAppStatus result", { ok });
        if (!ok) {
          return await ctx.answerCbQuery("确认失败，请重试", { show_alert: true });
        }

        const oldText = ctx.callbackQuery.message.text || "";
        const who = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || String(approverId));
        const newText = `${oldText}\n\n✅ 确认信息无误\n确认人：${who}\n时间：${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });

        const nextMsg = formatWithdrawCard({
          orderId,
          merchantName,
          currency,
          applyTime: applyTime,
          amount: amount,
          balanceAvailable,
          usdtAddress,
          addressHint,
          exchangeRate,
          usdtFinal,
          isSameAddress,
          optType,
          isConfirmInfo:false
        });
        log("editMessageText start (okAudit)");
        await ctx.reply(
          nextMsg,
          {
            parse_mode: "HTML",
            ...approveKeyboard(
              String(orderId),
              String(merchantNo),
              4
            )
          }
        );
        log("editMessageText done (okAudit)");
        return;
      }

      if (action === "noAudit") {
        log("enter noAudit branch===============");
        /*if (!(await isReviewer(orderId, ctx.from.id))) {
          warn("你没有权限,telegram:",ctx.from.id);
          return await ctx.answerCbQuery("你没有审核权限", { show_alert: true });
        }*/
        log("callbackAppStatus start", { orderId, approver, status: 2 });
        const ok = await callbackAppStatus(orderId, approver, 2);
        log("callbackAppStatus result", { ok });
        if (!ok) {
          warn("callbackAppStatus failed, try edit failure text");
          try {
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 处理失败，请重新提交</b>",
              { parse_mode: "HTML" }
            );
          } catch(err) {
            warn("editMessageText failed (progress)", err?.message || err);
          }
          return;
        }
        const original = msg?.text || msg?.caption || "";
        log("editMessageText start (noAudit)");
        const who = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || String(approverId));
        const newText = original + `\n\n <b>❌ 信息有误，已拒绝</b>\n<b>操作人：</b>${who}\n时间: ${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        log("editMessageText done (noAudit)");
        return;
      }


      const typeStr = parts[3];
      const type = parseInt(typeStr, 10);
      log("parsed type", { type, isNaN: Number.isNaN(type) });
      if (isNaN(type)) {
        errl("type 不是数字", { typeStr, data: cq.data });
        return false;
      }
      let ok = false;

      if (action === "ok") {
        log("enter ok branch===============");
        if (!(await isApprover(orderId, ctx.from.id))) {
          return await ctx.answerCbQuery("你没有确认权限", { show_alert: true });
        }

        // 读取审核状态
        log("getStageStatus start", { orderId, stage: "approve" });
        const reviewInfo = await getStageStatus(orderId, "approve");
        log("getStageStatus result", {
          has: !!reviewInfo,
          decided: reviewInfo?.decided,
          needCount: reviewInfo?.needCount,
          approvedByLen: (reviewInfo?.approvedBy || []).length
        });
        if (!reviewInfo) {
          warn("订单状态异常，请联系管理员");
          return;
        }

        if (reviewInfo.decided) {
          warn("该订单已处理", { show_alert: true })
          return await ctx.answerCbQuery("该订单已处理", { show_alert: true });
        }

        const needCount = reviewInfo.needCount || 1;
        const approved = reviewInfo.approvedBy || [];

        // 已经点过
        if (approved.includes(approverId)) {
          log("already approved by this user", { approverId });
          return await ctx.answerCbQuery("你已确认过，无需重复操作");
        }

        approved.push(approverId);
        reviewInfo.approvedBy = approved;

        log("saveStageStatus start", { stage: "approve", approvedLen: approved.length, needCount });
        await saveStageStatus(orderId, "approve",reviewInfo);
        log("saveStageStatus done", { stage: "approve" });

        const currentCount = approved.length;

        //更新 Telegram 消息里的审核进度
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const who = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || String(approverId));

        const baseText = original
          .replace(/已确认：\d+\/\d+(\n最后确认：.*)?/g, "")
          .replace(/✅[\s\S]*?时间：.*$/g, "")
          .trim();

        const progressLine = `已确认：${currentCount}/${needCount}\n最后确认：${who}（${ts}）`;
        const newTextWithProgress = `${baseText}\n\n${progressLine}`;

        //如果还没达到人数要求，提示等待其他老板
        log("editMessageText start (progress)", { currentCount, needCount });
        try {
          await ctx.editMessageText(newTextWithProgress, {
            parse_mode: "HTML",
            reply_markup: msg.reply_markup
          });
        } catch (err) {
          warn("editMessageText failed (progress)", err?.message || err);
        }

        if (currentCount < needCount) {
          log("waiting others", { currentCount, needCount });
          await ctx.answerCbQuery(`已确认 ${currentCount}/${needCount}，等待其他老板确认`, {
            show_alert: true
          });
          return; //终止，不进入通过逻辑
        }

        // 达到确认人数，进入最终通过流程
        reviewInfo.decided = true;
        await saveStageStatus(orderId, "approve", reviewInfo);
        log("saveStageStatus start (complete)");
        await saveStageStatus(orderId,"complete", reviewInfo);
        log("saveStageStatus done (complete)");

        log("tryDecide start");
        const got = await tryDecide(orderId);
        log("tryDecide result", { got });
        if (!got) return; // 幂等控制

        log("callback backend/account start", { type });
        if (type === 4) {
          ok = await callbackBackend(orderId, approver, 1);
        } else if ([1, 2, 3, 5].includes(type)) {
          ok = await callbackAccountStatus(orderId, approver, 1, type);
        } else {
          errl("type 超出范围", { type });
          return false;
        }
        log("callback backend/account result", { ok });

        if (!ok) {
          warn("final callback failed, try edit failure text");
          try {
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 订单处理失败，请重新提交</b>",
              { parse_mode: "HTML" }
            );
          } catch (err){
            warn("editMessageText failed (final fail)", err?.message || err);
          }
          return;
        }

        // 拼接通过后文本
        const finalText =
          `${baseText}\n\n` +
          `已确认：${currentCount}/${needCount}\n\n` +
          `✅ 订单已确认,请稍等!\n` +
          `确认人：${who}\n` +
          `时间：${ts}`;
        log("editMessageText start (final)");
        await ctx.editMessageText(finalText, { parse_mode: "HTML" });
        log("editMessageText done (final)");
        return;
      }

      if (action === "no") {

        log("enter no branch=====================");
        if (!(await isApprover(orderId, ctx.from.id))) {
          log("from Id:", (ctx.from.id));
          return await ctx.answerCbQuery("你没有确认权限", { show_alert: true });
        }

        log("tryDecide start");
        const got = await tryDecide(orderId);
        log("tryDecide result", { got });
        if (!got) return;

        log("callback backend/account start", { type });
        if (type === 4) {
          ok = await callbackBackend(orderId, approver, 2);
        } else if ([1, 2, 3, 5].includes(type)) {
          ok = await callbackAccountStatus(orderId, approver, 2, type);
        } else {
          errl("type 超出范围", { type });
          return false;
        }
        log("callback backend/account result", { ok });

        if (!ok) {
          warn("reject callback failed, try edit failure text");
          try {
            log("editMessageText start (reject final)");
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 处理失败，请重新提交</b>",
              { parse_mode: "HTML" }
            );
          } catch(err) {
            warn("editMessageText failed (reject fail)", err?.message || err);
          }
          return;
        }
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const who = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || String(approverId));
        const newText = original + `\n\n <b>❌ 订单被拒绝</b>\n<b>操作人：</b>${who}\n时间: ${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        return;
      }

      return;
    } catch (err) {
      console.error(err);
      // 这里可能已超过时限/已答复过，避免再次 answerCbQuery 导致同样 400
      try {
        await ctx.editMessageText("处理失败");
      } catch {
      }
    }
  });
}
async function getWithdrawInfo(orderId, merchantNo) {
  try {
    const data = await sysWithdrawContextService.findByOrderIdAndMerchantNo(orderId, merchantNo);
    if (!data) {
      console.warn(`[getWithdrawInfo] 未找到记录: orderId=${orderId}, merchantNo=${merchantNo}`);
      return null;
    }

    const time = new Date(data.applyTime)
      .toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false })
      .replace(', ', ' ');

    return {
      merchantName: data.merchantName,
      currency: data.currency,
      amount: Number(data.amount),
      balanceAvailable: Number(data.balanceAvailable),
      usdtAddress: data.usdtAddress || "",
      addressHint: data.addressHint || "",
      exchangeRate: Number(data.exchangeRate),
      usdtFinal: data.usdtFinal,
      isSameAddress: data.isSameAddress === 1 || data.isSameAddress === true,
      optType: Number(data.optType),
      applyTime: time,
      status: data.status
    };
  } catch (err) {
    console.error("[getWithdrawInfo] 查询数据库失败:", err);
    return null;
  }
}
module.exports = { registerCallbackHandler };
