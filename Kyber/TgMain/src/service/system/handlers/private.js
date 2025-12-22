const { callbackBackend } = require("../../system/backend");
const { getPending, clearPending, isDecided, tryDecide } = require("../../system/reviewStore");
const { rejectedFinal } = require("../../system/ui");

function registerPrivateHandler(bot) {
  bot.on("message", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const reason = ctx.message.text?.trim();
    if (!reason) return;

  });
}

console.log('[Group] module loaded from', __filename);

module.exports = { registerPrivateHandler };
