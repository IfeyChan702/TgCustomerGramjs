// handlers/callbacks.js
const { verify } = require("../security");
const { callbackBackend, callbackAppStatus } = require("../backend");
const { tryDecide, isDecided, isReviewer, getReviewStatus, saveReviewStatus, isApprover } = require("../reviewStore");
const { approvedSuffix, approveKeyboard, formatWithdrawCard } = require("../ui");

function registerCallbackHandler(bot) {
  bot.on("callback_query", async (ctx) => {
    try {
      console.log("[用户点击回调]callback_query");
      const parts = ctx.callbackQuery.data.split("|");
      const action = parts[0];
      const orderId = parts[1];
      const merchantNo = parts[2];
      const sig = parts[parts.length - 1];
      const extraFields = parts.slice(3, -1);
      if (!/^M\d{14,30}$/.test(merchantNo)) {
        return await ctx.answerCbQuery("商户NO格式错误", { show_alert: true });
      }

      if (!verify(action, orderId, merchantNo, sig)) {
        return await ctx.answerCbQuery("签名校验失败", { show_alert: true });
      }

      if (!(await isReviewer(orderId, ctx.from.id))) {
        return await ctx.answerCbQuery("你没有审核权限", { show_alert: true });
      }

      const approver = ctx.from.username || ctx.from.first_name || String(ctx.from.id);
      const ts = new Date().toLocaleString();
      const approverId = ctx.from.id;

      await ctx.answerCbQuery("处理中…");

      let merchantName, currency, amount, balanceAvailable, usdtAddress, addressHint, exchangeRate, usdtFinal,
        isSameAddress, optType;
      if (action === "okAudit") {
        [
          merchantName,
          currency,
          amount,
          balanceAvailable,
          usdtAddress,
          addressHint,
          exchangeRate,
          usdtFinal,
          isSameAddress,
          optType
        ] = extraFields;

        amount = Number(amount);
        balanceAvailable = Number(balanceAvailable);
        exchangeRate = Number(exchangeRate);
        usdtFinal = Number(usdtFinal);
        isSameAddress = isSameAddress === "true" || isSameAddress === true;
        optType = Number(optType);
      }
      if (action === "okAudit") {
        if (!(await isReviewer(orderId, ctx.from.id))) {
          return await ctx.answerCbQuery("你没有审核权限", { show_alert: true });
        }

        const ok = await callbackAppStatus(orderId, approver, 1);

        if (!ok) {
          return await ctx.answerCbQuery("确认失败，请重试", { show_alert: true });
        }

        const oldText = ctx.callbackQuery.message.text || "";
        const newText = `${oldText}\n\n✅ 确认信息无误\n时间：${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });

        const nextMsg = formatWithdrawCard({
          orderId,
          merchantName,
          currency,
          applyTime: ts,
          amount: amount,
          balanceAvailable,
          usdtAddress,
          exchangeRate,
          usdtFinal,
          isSameAddress,
          optType
        });

        await ctx.telegram.sendMessage(ctx.chat.id, nextMsg, {
          parse_mode: "HTML",
          reply_markup: approveKeyboard(orderId, merchantName)
        });

        return;
      }

      if (action === "noAudit") {
        if (!(await isReviewer(orderId, ctx.from.id))) {
          return await ctx.answerCbQuery("你没有审核权限", { show_alert: true });
        }
        //TODO
        const ok = await callbackAppStatus(orderId, approver, 2);
        if (!ok) {
          try {
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 处理失败，请重新提交</b>",
              { parse_mode: "HTML" }
            );
          } catch {
          }
          return;
        }
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const newText =
          original + `\n\n <b>❌ 信息有误，已拒绝</b> \n时间: ${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        return;
      }

      if (action === "ok") {

        if (!(await isApprover(orderId, ctx.from.id))) {
          return await ctx.answerCbQuery("你没有确认权限", { show_alert: true });
        }

        // 读取审核状态
        const reviewInfo = await getReviewStatus(orderId);
        if (!reviewInfo) {
          return await ctx.answerCbQuery("订单状态异常，请联系管理员", { show_alert: true });
        }

        if (reviewInfo.decided) {
          return await ctx.answerCbQuery("该订单已处理", { show_alert: true });
        }

        const needCount = reviewInfo.needCount || 1;
        const approved = reviewInfo.approvedBy || [];

        // 已经点过
        if (approved.includes(approverId)) {
          return await ctx.answerCbQuery("你已确认过，无需重复操作");
        }

        // 添加本次审核人
        approved.push(approverId);
        reviewInfo.approvedBy = approved;
        await saveReviewStatus(orderId, reviewInfo);

        const currentCount = approved.length;

        //更新 Telegram 消息里的审核进度
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const progressLine = `已确认：${currentCount}/${needCount}`;
        const baseText = original.replace(/已确认：\d+\/\d+/g, ""); // 清理旧的进度行
        const newTextWithProgress = baseText + `\n${progressLine}`;

        //如果还没达到人数要求，提示等待其他老板
        try {
          await ctx.editMessageText(newTextWithProgress, {
            parse_mode: "HTML",
            reply_markup: ctx.callbackQuery.message.reply_markup
          });
        } catch (err) {
          console.warn("更新进度信息失败：", err.message);
        }

        if (currentCount < needCount) {
          await ctx.answerCbQuery(`已确认 ${currentCount}/${needCount}，等待其他老板确认`, {
            show_alert: true
          });
          return; //终止，不进入通过逻辑
        }

        // 达到确认人数，进入最终通过流程
        reviewInfo.decided = true;
        await saveReviewStatus(orderId, reviewInfo);

        const got = await tryDecide(orderId);
        if (!got) return; // 幂等控制

        const ok = await callbackBackend(orderId, approver, 3);
        if (!ok) {
          try {
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 订单处理失败，请联系客服</b>",
              { parse_mode: "HTML" }
            );
          } catch {
          }
          return;
        }

        // 拼接通过后文本
        const finalText = newTextWithProgress + approvedSuffix(ts);
        await ctx.editMessageText(finalText, { parse_mode: "HTML" });
        return;
      }

      if (action === "no") {

        if (!(await isApprover(orderId, ctx.from.id))) {
          return await ctx.answerCbQuery("你没有确认权限", { show_alert: true });
        }

        const got = await tryDecide(orderId);
        if (!got) return;

        const ok = await callbackBackend(orderId, approver, 4);
        if (!ok) {
          try {
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 处理失败，请重新提交</b>",
              { parse_mode: "HTML" }
            );
          } catch {
          }
          return;
        }
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const newText =
          original + `\n\n <b>❌ 提现申请被拒绝</b> \n时间: ${ts}`;
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

module.exports = { registerCallbackHandler };
