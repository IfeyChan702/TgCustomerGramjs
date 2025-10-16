// handlers/callbacks.js
const { verify } = require("../security");
const { callbackBackend } = require("../backend");
const { tryDecide, isDecided, isReviewer,getReviewStatus,saveReviewStatus } = require("../reviewStore");
const { approvedSuffix, waitingReasonSuffix } = require("../ui");

function registerCallbackHandler(bot) {
  bot.on("callback_query", async (ctx) => {
    try {
      console.log("[用户点击回调]callback_query");
      const [action, orderId, mno, sig] = ctx.callbackQuery.data.split("|");
      const merchantNo = mno;
      if (!/^M\d{14,30}$/.test(mno)) {
        return await ctx.answerCbQuery("商户NO格式错误", { show_alert: true });
      }

      // 1) 先做纯计算/快速校验（不访问慢服务）
      if (!verify(action, orderId, merchantNo, sig)) {
        return await ctx.answerCbQuery("签名校验失败", { show_alert: true });
      }

      if (!(await isReviewer(orderId, ctx.from.id))) {
        return await ctx.answerCbQuery("你没有审核权限", { show_alert: true });
      }

      if (await isDecided(orderId)) {
        return await ctx.answerCbQuery("该笔已处理");
      }

      // 2) 立刻答复，避免超时（只答复一次）
      await ctx.answerCbQuery("处理中…"); // 先秒回

      const approver = ctx.from.username || ctx.from.first_name || String(ctx.from.id);
      const ts = new Date().toLocaleString();

      if (action === "ok") {
        const approverId = ctx.from.id;
        const approver = ctx.from.username || ctx.from.first_name || String(ctx.from.id);
        const ts = new Date().toLocaleString();

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
            reply_markup: ctx.callbackQuery.message.reply_markup, // ✅ 保留按钮
          });
        } catch (err) {
          console.warn("更新进度信息失败：", err.message);
        }

        if (currentCount < needCount) {
          await ctx.answerCbQuery(`已确认 ${currentCount}/${needCount}，等待其他老板确认`, {
            show_alert: true,
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
          } catch {}
          return;
        }

        // 拼接通过后文本
        const finalText = newTextWithProgress + approvedSuffix(ts);
        await ctx.editMessageText(finalText, { parse_mode: "HTML" });
        return;
      }

      if (action === "no") {
        const got = await tryDecide(orderId);
        if (!got) return;

        const ok = await callbackBackend(orderId, approver, 4);
        if (!ok) {
          try {
            await ctx.editMessageText(
              (ctx.callbackQuery.message.text || "") + "\n<b>⚠️ 处理失败，请重新申请订单或者联系技术人员</b>",
              { parse_mode: "HTML" }
            );
          } catch {}
          return;
        }
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const newText =
          original + `<b>❌ 已拒绝</b> \n时间: ${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        return;
      }

      return;
    } catch (err) {
      console.error(err);
      // 这里可能已超过时限/已答复过，避免再次 answerCbQuery 导致同样 400
      try {
        await ctx.editMessageText("处理失败");
      } catch {}
    }
  });
}

module.exports = { registerCallbackHandler };
