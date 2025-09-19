const { callbackBackend } = require("../../system/backend");
const { getPending, clearPending, isDecided, tryDecide } = require("../../system/reviewStore");
const { rejectedFinal } = require("../../system/ui");

function registerPrivateHandler(bot) {
  bot.on("message", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const reason = ctx.message.text?.trim();
    if (!reason) return;

    const pending = await getPending(ctx.from.id);
    if (!pending) return;

    const { orderId, chatId, messageId } = pending;

    if (await isDecided(orderId)) {
      await ctx.reply("该笔已处理。");
      await clearPending(ctx.from.id);
      return;
    }

    // 抢占决定权
    const got = await tryDecide(orderId);
    if (!got) {
      await ctx.reply("该笔已处理。");
      await clearPending(ctx.from.id);
      return;
    }

    const ok = await callbackBackend(orderId, "no", ctx.from.id, reason);
    if (!ok) return ctx.reply("后端失败，请稍后再试。");

    const ts = new Date().toLocaleString();
    const final = rejectedFinal(ctx.from.username || ctx.from.first_name, ts, reason);

    try {
      await ctx.telegram.editMessageText(chatId, messageId, undefined, final, { parse_mode: "HTML" });
    } catch {
      await ctx.telegram.sendMessage(chatId, final, { parse_mode: "HTML" });
    }

    await clearPending(ctx.from.id);
    await ctx.reply("已提交拒绝理由。");
  });
}

console.log('[Group] module loaded from', __filename);

module.exports = { registerPrivateHandler };
