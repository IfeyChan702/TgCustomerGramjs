// handlers/callbacks.js
const { verify } = require("../security");
const { callbackBackend } = require("../backend");
const { tryDecide, isDecided, isReviewer, setPending } = require("../reviewStore");
const { approvedSuffix, waitingReasonSuffix } = require("../ui");

function registerCallbackHandler(bot) {
  bot.on("callback_query", async (ctx) => {
    try {
      console.log("[用户点击回调]callback_query");
      const [action, orderId, mid, sig] = ctx.callbackQuery.data.split("|");
      const merchantId = parseInt(mid, 10);

      // 1) 先做纯计算/快速校验（不访问慢服务）
      if (!verify(action, orderId, merchantId, sig)) {
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
        const got = await tryDecide(orderId);
        if (!got) {
          // 不再二次 answerCbQuery，直接尝试提示用户方式是编辑消息或忽略
          return;
        }

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

        // 使用 text 或 caption 兼容
        const original = ctx.callbackQuery.message.text || ctx.callbackQuery.message.caption || "";
        const newText = original + approvedSuffix(ctx.from.username || ctx.from.first_name, ts);
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
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
          original + `<b>❌ 已拒绝</b>\n审核人: ${ctx.from.username || ctx.from.first_name}\n时间: ${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        return;
      }

      return;
    } catch (err) {
      console.error(err);
      // 这里可能已超过时限/已答复过，避免再次 answerCbQuery 导致同样 400
      try {
        await ctx.editMessageText("处理失败，请重试");
      } catch {}
    }
  });
}

module.exports = { registerCallbackHandler };
