const tgMsgMon = require("./tgMsgHandService");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { redis } = require("../../models/redisModel");
const tgChatMsgService = require("./tgChatMsgService");
const tgChatService = require("./tgChatService");

/**
 * 处理用户接收消息，将消息存储到数据库
 * @param client
 * @param event
 * @return {Promise<void>}
 */
exports.recMsg = async (client, event) => {
  try {
    const chatId = event.chatId?.valueOf();
    const message = event.message;
    if (!chatId || !message) return;

    const me = await client.getMe();
    const telegramId = me.id;

    const redisKeyChat = `tg:chat:exists:${chatId}`;
    const redisKeyRelation = `tg:chat:relation:${telegramId}:${chatId}`;
    const chatInfo = await client.getEntity(chatId);

    const relaExists = await redis.get(redisKeyRelation);

    if (relaExists === null) {
      const tgAccountChatData = await tgChatMsgService.getByTelegramIdChatId(telegramId, chatId);
      if (!tgAccountChatData) {
        const insTgAccountChat = await tgChatMsgService.insert(telegramId, chatId);
        if (insTgAccountChat.affectedRows === 1) {
          await redis.set(redisKeyRelation, "1", "EX", 60 * 60 * 24);
        }
      } else {
        await redis.set(redisKeyRelation, "1", "EX", 60 * 60 * 24);
      }
    }

    const chatIdExists = await redis.get(redisKeyChat);
    const chatData = {
      chat_id: chatId,
      type: chatInfo.className?.toLowerCase() || "unknown",
      username: chatInfo.username || null,
      invite_link: chatInfo.inviteLink || null,
      access_hash: chatInfo.accessHash?.toString() || null,
      is_active: 1
    };

    if (chatIdExists === null) {
      const tgChatData = await tgChatService.getByChatId(chatId);
      if (!tgChatData) {
        insChat = await tgChatService.insert(chatData);
        if (insChat.affectedRows === 1) {
          await redis.set(redisKeyChat, "1", "EX", 60 * 60 * 24);
        }
      }
    } else {
      await redis.set(redisKeyChat, "1", "EX", 60 * 60 * 24);
    }

    await handMessage();

  } catch (err) {
    console.error("[recMsg 错误]", err);
  }
};

async function handMessage(client,event){

}
