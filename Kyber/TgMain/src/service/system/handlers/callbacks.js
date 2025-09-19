// handlers/callbacks.js
const { verify } = require("../security");
const { callbackBackend } = require("../backend");
const { tryDecide, isDecided, isReviewer, setPending } = require("../reviewStore");
const { approvedSuffix, waitingReasonSuffix } = require("../ui");

function registerCallbackHandler(bot) {
  bot.on("callback_query", async (ctx) => {
    try {
      console.log("[用户点击回调]callback_query")
      const [action, orderId, mid, sig] = ctx.callbackQuery.data.split("|");
      const merchantId = parseInt(mid, 10);

      if (!verify(action, orderId, merchantId, sig)) {
        return ctx.answerCbQuery("签名校验失败", { show_alert: true });
      }

      if (!(await isReviewer(orderId, ctx.from.id))) {
        return ctx.answerCbQuery("你没有审核权限", { show_alert: true });
      }

      if (await isDecided(orderId)) {
        return ctx.answerCbQuery("该笔已处理");
      }

      const approver =
        ctx.from.username ||
        ctx.from.first_name ||
        String(ctx.from.id);

      if (action === "ok") {
        const got = await tryDecide(orderId);
        if (!got) return ctx.answerCbQuery("该笔已处理");

        const ok = await callbackBackend(orderId, approver, 3);
        if (!ok) return ctx.answerCbQuery("后端失败", { show_alert: true });

        const ts = new Date().toLocaleString();
        const newText = ctx.callbackQuery.message.text + approvedSuffix(ctx.from.username || ctx.from.first_name, ts);
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        await ctx.answerCbQuery("已同意");
      }

      if (action === "no") {
        const got = await tryDecide(orderId);
        if (!got) return ctx.answerCbQuery("该笔已处理");

        const ok = await callbackBackend(orderId, approver, 4);
        /*if (!ok) return ctx.answerCbQuery("后端失败", { show_alert: true });*/

        const ts = new Date().toLocaleString();
        const newText = ctx.callbackQuery.message.text + `<b>❌ 已拒绝</b>\n审核人: ${ctx.from.username || ctx.from.first_name}\n时间: ${ts}`;
        await ctx.editMessageText(newText, { parse_mode: "HTML" });
        await ctx.answerCbQuery("已拒绝");
      }
    } catch (err) {
      console.error(err);
      ctx.answerCbQuery("处理失败", { show_alert: true });
    }
  });
}

module.exports = { registerCallbackHandler };
