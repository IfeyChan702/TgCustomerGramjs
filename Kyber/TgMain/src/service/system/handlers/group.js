// src/service/system/handlers/group.js
const tgCommandListService = require("../../command/tgCommandListService");
const merCommand = require("./groupCommand/merCommand");
const { getWizard, setWizard, findWizardByChat } = require("../../system/merchantWizard");
console.log("[Group] module loaded from", __filename);
const { createMerchantChat } = require("../../../service/system/sysMerchantChatService");
const { clearWizard } = require("../merchantWizard");
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
    const from = ctx.from;
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
      // 1) /getchatId1
      if (/^\/getchatId1(?:@\w+)?$/i.test(token)) {

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
      // 3) /bind —— 拿到群的chatId,然后将群里的chatId进行绑定
      if (/^\/bind(?:@\w+)?$/i.test(token)) {
        const state = getWizard(ctx.from.id);
        if (!state || !state.step.startsWith("WAIT_GROUP_BIND")) return;

        state.chatId = ctx.chat.id;
        state.step = "CREATE_WAIT_MERCHANT_NO";
        setWizard(ctx.from.id, state);

        await ctx.telegram.sendMessage(ctx.from.id, "群已绑定设置，请输入商户号");
        return;
      }

      if (/^\/join_approve(?:@\w+)?$/i.test(token)) {
        const state = findWizardByChat(ctx.chat.id);
        if (!state || state.step !== "CREATE_WAIT_APPROVE_JOIN") return;

        const uid = ctx.from.id;

        if (state.approveCandidates.includes(uid)) return;

        state.approveCandidates.push(uid);
        setWizard(state.ownerId, state);

        if (
          state.expectedApproveCount > 0 &&
          state.approveCandidates.length === state.expectedApproveCount &&
          !state.finished
        ) {
          state.finished = true;
          setWizard(state.ownerId, state);

          await createMerchantChat({
            merchantNo: state.merchantNo,
            merchantName: state.merchantName,
            chatId: state.chatId,
            approveIds: state.approveCandidates
          });

          const approveList = state.approveCandidates
            .map((id, i) => `${i + 1}. ${id}`)
            .join("\n");

          try {
            await ctx.telegram.sendMessage(
              state.ownerId,
              `✅ 商户创建成功\n\n` +
              `商户号：${state.merchantNo}\n` +
              `商户名：${state.merchantName}\n` +
              `群ID：${state.chatId}\n\n` +
              `审批人（${state.expectedApproveCount}人）：\n${approveList}`
            );
          } catch (e) {
            console.error("无法通知操作人：", e.message);
          }

          // 清理 wizard（只清一次）
          clearWizard(state.ownerId);
        }
        return;
      }

      const parts = text.trim().split(/\s+/);

      const rawCmdToken = token || parts[0] || "";
      const identifier = rawCmdToken.replace(/^\//, "").split("@")[0].toLowerCase();

      const restText = text.slice(cmdEnt.offset + cmdEnt.length).trim();
      const userArgs = restText ? restText.split(/\s+/) : [];
      //todo 这里生产的时候需要注意，更改，api.pay.ersan.click测试，api.gamecloud.vip生产
      const command = await tgCommandListService.getByIdentifierUrl(identifier, "api.gamecloud.vip");
      if (command) {

        const context = await merCommand.requestErsanUrl(command, userArgs, ctx.chat.id);

        if (!context) return next?.();
        console.log(`[group]中的context为${context}`);
        return ctx.reply(context, {
          parse_mode: "HTML"
        });
      }
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
