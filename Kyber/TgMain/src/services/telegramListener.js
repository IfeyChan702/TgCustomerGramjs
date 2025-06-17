const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");
const input = require("input");
const { startRedis, redis } = require("../models/redisModel");
const { makeRegisterKey } = require("../utils/helpers");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const orderContextMap = new Map();

// const apiId = 23539286;
// const apiHash = "02950d6f4ebe5564112b82243315fa59";
const registerId = "cb71ff13-9d9a-48a4-90a6-0e3dd7c2a26f";

// Start Redis connection
startRedis();
// const data = await redis.hGetAll(makeRegisterKey(registerId));


const SOURCE_CHAT_ID = -4893629782; // Chat ID to listen to
const TARGET_CHAT_ID = -4658228791; // Chat ID to forward the modified image

async function listener() {
  const data = await redis.hGetAll(makeRegisterKey(registerId));
  const session = new StringSession(data.session);
  const client = new TelegramClient(session, Number(data.apiId), data.apiHash, { connectionRetries: 5 });

  await client.start();
  console.log('[Telegram] 已连接，监听开始...');

  // await client.start({
  //   phoneNumber: async () => await input.text("Enter phone number: "),
  //   password: async () => await input.text("Enter password: "),
  //   phoneCode: async () => await input.text("Enter code sent to Telegram: "),
  //   onError: (err) => console.error(err),
  // });

  console.log("Bot is listening for messages...");

  client.addEventHandler(async (event) => {
    const message = event.message;

    if (message.message.trim().length > 0 && message.chatId.valueOf() === SOURCE_CHAT_ID && message.media?.className === 'MessageMediaPhoto') {
      console.log("Image detected, modifying caption...");
      const orderId = message.message.trim();
      const response = await axios.get(`https://bi.humideah.com/bi/payin/check`, {
        params: { order_id: orderId }
      });

      const channelOrderId = response.data?.channel_order_id || '未获取到渠道单号';


      // const newCaption = "This is the modified caption."; // Change the caption here

      // Send the modified media to the target chat
      const sentMsg =await client.sendFile(TARGET_CHAT_ID, {
        file: message.media,
        caption: `channelOrderId：${channelOrderId}`,
      });

      console.log("Message sent successfully!");

      // 保存上下文（单个订单用）
      orderContextMap.set(sentMsg.id, {
        orderId,
        originalMsgId: message.id,
        fromChat: SOURCE_CHAT_ID
      });

    }

    if (message.chatId.valueOf() === TARGET_CHAT_ID && message.replyTo && message.replyTo.replyToMsgId) {
      const replyToId = message.replyTo.replyToMsgId;
      const context = orderContextMap.get(replyToId);

      if (context) {
        const replyContent = message.text || '';

        await client.sendMessage(context.fromChat, {
          message: replyContent,
          replyTo: context.originalMsgId
        });

        console.log(`[INFO] 回复已转发回原群 ${context.fromChat} 并引用消息 ${context.originalMsgId}`);

        // 可选：清理上下文
        orderContextMap.delete(replyToId);
      } else {
        console.warn(`[WARN] 未找到关联上下文，replyToMsgId: ${replyToId}`);
      }
    }




  },  new NewMessage({}));

}

listener();
// module.exports = { listener };
