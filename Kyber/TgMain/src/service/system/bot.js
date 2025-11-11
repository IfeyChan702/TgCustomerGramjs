const { Telegraf } = require("telegraf");
const { botToken, alarmBotToken } = require("../../config/botConfig");

const { registerCallbackHandler } = require("./handlers/callbacks");
const { registerPrivateHandler } = require("./handlers/private");
const { registerGroupHandler } = require("./handlers/group");
if (!botToken) {
  console.error("❌ 请在 .env.development 中配置 BOT_TOKEN");
  process.exit(1);
}

const bot = new Telegraf(botToken);

const alarmBot = new Telegraf(alarmBotToken);

// 启动
async function startBot() {
  console.log("[BOT] starting...");
  try {
    // ---- 0) 先测能否直连 Telegram API ----
    const me = await bot.telegram.getMe(); // <--- 关键：不等 launch，先打 API
    console.log("[BOT] getMe OK, username =", me.username);

    // ---- 1) 处理 webhook 冲突 ----
    try {
      const info = await bot.telegram.getWebhookInfo();
      console.log("[BOT] webhook info:", info);
      if (info.url) {
        console.log("[BOT] webhook detected =>", info.url);
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log("[BOT] webhook removed");
      }
    } catch (e) {
      console.warn("[BOT] getWebhookInfo failed:", e && e.message);
    }

    // ---- 2) 启动 polling 且丢弃旧消息 ----
    await bot.launch({ dropPendingUpdates: true });
    console.log("[BOT] started polling as @" + me.username);

  } catch (err) {
    console.error("❌ startBot error:", err?.stack || err);
    throw err;
  }
}

bot.use(async (ctx, next) => {
  console.log("[BOT] incoming:", ctx.updateType, ctx.message?.text);
  try {
    return await next();
  } catch (e) {
    console.error("[BOT] middleware error:", e);
  }
});

registerCallbackHandler(bot);
registerGroupHandler(bot);
registerPrivateHandler(bot);
module.exports = { startBot, bot };
