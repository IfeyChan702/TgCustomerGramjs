const { callbackBackend } = require("../../system/backend");
const { getPending, clearPending, isDecided, tryDecide } = require("../../system/reviewStore");
const { rejectedFinal } = require("../../system/ui");
const { onMerchantMessage } = require("../handlers/merchantWizardHandler");

function registerPrivateHandler(bot) {
  bot.command("merchant", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    await ctx.reply("请选择操作：", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ 创建商户绑定", callback_data: "merchant:create" }],
          [{ text: "🔍 查询商户绑定", callback_data: "merchant:query" }],
          [{ text: "👥 修改审批权限", callback_data: "merchant:approve" }],
          [{ text: "🗑 删除商户绑定", callback_data: "merchant:delete" }],
        ]
      }
    });
  });

  bot.on("message", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const handled = await onMerchantMessage(ctx);
    if (handled) return;
  });
}

module.exports = { registerPrivateHandler };
