const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Api } = require('telegram');
const { startRedis, redis } = require("../models/redisModel");
const { makeRegisterKey } = require("../utils/helpers");
const axios = require('axios');
const {getLatestAccountIds,getLatestRegisterIds , getAccountByRegisterIdArray ,insertGroupChannel, getChatIdsByAccountInChannel, getChatIdsByAccountInMerchant, insertGroupMerchant, getChatIdsByChannelIdInChannel} = require("../models/app");

const sourceGroupIds = new Set();
const orderContextMap = new Map();
const channelMap = new Map();
const channelGroupIds = new Set();

async function startOrderListener() {

  const AccountId = await getLatestAccountIds();
  const registerId = await getLatestRegisterIds();
  // const key = makeRegisterKey(registerId);
  // const registerIds = ["cbeb6c03-ad17-46f7-b2a3-537099238cd9", "cb71ff13-9d9a-48a4-90a6-0e3dd7c2a26f"];
  const accountDetails = await getAccountByRegisterIdArray(registerId);

  // if (!redis.isOpen) {
  //   await redis.connect();
  //   console.log('[Redis] 已连接');
  // }

  const isMissingValues = accountDetails.some(account =>
    !account.session || !account.api_id || !account.api_hash
  );
  if (isMissingValues) {
    console.error(`[ERROR] 无法启动监听，registerId 数据不完整`);
    return;
  }

  // const client = new TelegramClient(
  //   new StringSession(data.session),
  //   Number(data.api_id),
  //   data.api_hash,
  //   { connectionRetries: 5 }
  // );
  //
  // await client.connect();

  const clients = [];
  for (const data of accountDetails) {
    const client = new TelegramClient(
      new StringSession(data.session),
      Number(data.api_id),
      data.api_hash,
      { connectionRetries: 5 }
    );

    await client.connect();
    console.log(`Client connected: ${data.api_id}`);

    client.addEventHandler(async (event) => {

      const chatId = event.chatId?.valueOf();
      // Fetch chat details
      const chat = await client.getEntity(chatId);
      const chatTitle = chat.title;
      const message = event.message;

      // 标记渠道群 ID
      if (
        typeof message.message === 'string' &&
        message.message.startsWith('此群渠道群ID设为') &&
        message.message.includes("监听")
      ) {
        // const match_1 = message.message.match(/此群渠道群ID设为(\d+)/);
        // const match_2 = message.message.match(/由(.+?)監聽/);
        const match = message.message.match(/此群渠道群ID设为(\d+)由(.+?)监听/);
        if (match) {
          const channelId = match[1];
          const AccountId = match[2];
          // channelMap.set(String(channelId), chatId); // 标记当前群为该 channelId
          const newGroupChannel = await insertGroupChannel(AccountId, String(channelId), chatId, chatTitle, "channel", 1);
          // channelGroupIds.add(chatId);

          await client.sendMessage(chatId, {
            message: `渠道群绑定成功：渠道Id = ${channelId}, 由 ${AccountId} 机器人监听`,
          });
          console.log(`[INFO] 渠道群 ${chatId} 已标记为 channelId ${channelId}, 由 ${AccountId} 机器人监听`);
        }
        return;
      }

      // 标记商户群
      if (typeof message.message === 'string' && message.message.startsWith('此群标记为商户群') && message.message.includes("监听")) {
        // sourceGroupIds.add(chatId);
        const match = message.message.match(/由(.+?)监听/);
        if (match) {
          const AccountId = match[1];
          const newGroupMerchant = await insertGroupMerchant(AccountId, chatId, chatTitle, "merchant", 1);
          await client.sendMessage(chatId, {
            message: ` 当前群 ${chatId} 已标记为商户群, 由 ${AccountId} 机器人监听`
          });
          console.log(`[INFO] 群 ${chatId} 被标记为商户群, 由 ${AccountId} 机器人监听`);
        }
        return;
      }

      // 监听来源群
      if (
        message.media?.className === 'MessageMediaPhoto' &&
        typeof message.message === 'string' && // 图片附带的文字
        message.message.trim().length > 0
      ) {

        const sourceGroupIds = await getChatIdsByAccountInMerchant(registerId);
        if(sourceGroupIds.has(String(chatId))){

          const orderId = message.message.trim();
          console.log(`[INFO] 检测到订单号: ${orderId}，请求接口中...`);

          try {
            const response = await axios.get(`https://bi.humideah.com/bi/payin/check`, {
              params: { order_id: orderId }
            });

            const channelId = response.data?.channel_id || '未获得到渠道ID';
            const channelOrderId = response.data?.channel_order_id || '未获取到渠道单号';
            // const targetChatId = channelMap.get(String(channelId));
            const targetChatId = await getChatIdsByChannelIdInChannel(String(channelId));

            if (!targetChatId) {
              console.warn(`[WARN] 未找到 channelId=${channelId} 对应的群`);
              return;
            }

            // 使用 sendFile 发送到目标群，并添加新的 caption
            const sentMsg = await client.sendFile(targetChatId, {
              file: message.media,
              caption: `channelOrderId：${channelOrderId}`
            });

            console.log(`[INFO] 渠道单号已发送至 目标群`);

            // 保存上下文（单个订单用）
            orderContextMap.set(sentMsg.id, {
              orderId,
              originalMsgId: message.id,
              fromChat: chatId
            });

          } catch (err) {
            console.error(`[ERROR] 请求接口失败:`, err.message);
          }
        }
      }

      // 渠道群回复监听 → 转发回商户群
      if ( message.replyTo && message.replyTo.replyToMsgId) {
        const channelGroupIds = await getChatIdsByAccountInChannel(registerId);
        if(channelGroupIds.has(String(chatId)) ){
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
      }
    }, new NewMessage({}));

    // 防止退出
    setInterval(() => {}, 100000);

    clients.push(client);
  }

  console.log("All clients are connected and listening for events!");


  console.log('[Telegram] 已连接，监听开始...');


}

startOrderListener().catch(console.error);
