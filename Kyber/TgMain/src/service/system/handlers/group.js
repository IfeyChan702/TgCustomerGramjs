// src/service/system/handlers/group.js
const tgCommandListService = require("../../command/tgCommandListService");
const merCommand = require("./groupCommand/merCommand");
console.log("[Group] module loaded from", __filename);

function registerGroupHandler(bot) {
  console.log("[Group] registerGroupHandler() called from", __filename);

  // 打印每条更新，便于排查
  bot.use((ctx, next) => {
    console.log("[U]", ctx.updateType, "chat=", ctx.chat?.id, "type=", ctx.chat?.type, "title=", ctx.chat?.title);
    return next();
  });

  bot.on("message", async (ctx, next) => {
    const ents = ctx.message?.entities || [];
    const cmdEnt = ents.find(e => e.type === "bot_command");
    if (!cmdEnt) return next?.();

    const text = ctx.message.text || "";
    const token = text.slice(cmdEnt.offset, cmdEnt.offset + cmdEnt.length);

    // 1) /getchatid
    if (/^\/getchatId1(?:@\w+)?$/i.test(token)) {
      if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
        // 如果不是群，直接忽略（或自行决定要不要在私聊返回）
        return;
      }

      const from = ctx.from;
      if (!from) return;

      if (from.is_bot) {
        console.log(`[Group] ${from.username} 是 bot，不私聊`);
        return;
      }

      try {
        await ctx.telegram.sendMessage(
          from.id,
          [
            `📣 群聊信息：`,
            `chatId：${ctx.chat.id}`,
            `类型：${ctx.chat.type}`,
            ctx.chat.title ? `标题：${ctx.chat.title}` : ""
          ].filter(Boolean).join("\n")
        );
      } catch (err) {
        console.error("[Group] 无法私聊用户:", err.message);
      }

      return;
    }

    // 2) /meTelegramId —— 显示用户的 numeric ID
    if (/^\/meTelegramId(?:@\w+)?$/i.test(token)) {
      const from = ctx.from;
      if (!from) return;

      const isAnonAdmin = String(from.id) === "1087968824";
      const msg = [
        `你的 <b>Telegram User ID</b>(数字)是: <code>${from.id}</code>`,
        from.username ? `用户名:@${from.username}` : null,
        (from.first_name || from.last_name) ? `姓名:${[from.first_name, from.last_name].filter(Boolean).join(" ")}` : null,
        isAnonAdmin ? "你当前以“匿名管理员”身份发言，我无法看到真实的 User ID。" : null
      ].filter(Boolean).join("\n");

      try {
        await ctx.telegram.sendMessage(from.id, msg, { parse_mode: "HTML" });
      } catch (err) {
        console.error("[Group]无法私聊用户:", err.message);
      }
      return;
    }

    const parts = text.trim().split(/\s+/);
    const identifier = parts[0].replace("/", "");
    const userArgs = parts.slice(1);
    const command = await tgCommandListService.getByIdentifierUrl(identifier, "api.pay.ersan.click");
    if (command) {

      const context = await merCommand.requestErsanUrl(command, userArgs, ctx.chat.id);

      if (!context) return next?.();
      console.log(`[group]中的context为${context}`);
      return ctx.reply(context, {
        parse_mode: "HTML"
      });
    }
    return next?.();
  });

  // 频道：匹配 channel_post 里的命令
  bot.on("channel_post", async (ctx, next) => {
    const ents = ctx.channelPost?.entities || [];
    const cmd = ents.find(e => e.type === "bot_command");
    if (!cmd) return next?.();

    const text = ctx.channelPost.text || "";
    const token = text.slice(cmd.offset, cmd.offset + cmd.length);
    if (!/^\/getchatid(?:@\w+)?$/i.test(token)) return next?.();

    console.log("[Group] /getchatid matched in channel");
    return ctx.replyWithHTML(
      [
        `当前频道的 <b>chatId</b>: <code>${ctx.chat.id}</code>`,
        `类型: ${ctx.chat.type}`,
        ctx.chat.title ? `标题: ${ctx.chat.title}` : null
      ].filter(Boolean).join("\n")
    );
  });
}

module.exports = { registerGroupHandler };
