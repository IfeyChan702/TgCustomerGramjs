const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Api } = require('telegram');
const { redis } = require('../models/redisModel');
const { makeRegisterKey } = require('../utils/helpers');
const axios = require('axios');

const registerId = 'cb71ff13-9d9a-48a4-90a6-0e3dd7c2a26f';
const key = makeRegisterKey(registerId);
const orderContextMap = new Map();

async function startOrderListener() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log('[Redis] 已连接');
  }
  const data = await redis.hGetAll(key);

  if (!data?.session || !data?.apiId || !data?.apiHash) {
    console.error(`[ERROR] 无法启动监听，registerId 数据不完整`);
    return;
  }

  const client = new TelegramClient(
    new StringSession(data.session),
    Number(data.apiId),
    data.apiHash,
    { connectionRetries: 5 }
  );

  await client.connect();
  console.log('[Telegram] 已连接，监听开始...');

  client.addEventHandler(async (event) => {
    const chatId = event.chatId?.valueOf();
    const message = event.message;

    // 监听来源群为 -4893629782
    if (
      chatId === -4893629782 &&
      message.media?.className === 'MessageMediaPhoto' &&
      typeof message.message === 'string' && // 图片附带的文字
      message.message.trim().length > 0
    ) {
      const orderId = message.message.trim();
      console.log(`[INFO] 检测到订单号: ${orderId}，请求接口中...`);

      try {
        const response = await axios.get(`https://bi.humideah.com/bi/payin/check`, {
          params: { order_id: orderId }
        });

        const channelOrderId = response.data?.channel_order_id || '未获取到渠道单号';

        const { CustomFile } = require('telegram/client/uploads');

  // 下载原始图片
        const buffer = await client.downloadMedia(message);

        if (!buffer || buffer.length === 0) {
          console.error(`[ERROR] 图片下载失败`);
          return;
        }

  // 包装 buffer 为 jpeg 图片格式
        const file = new CustomFile(
          `${channelOrderId}.jpg`, // 文件名（建议使用订单号）
          buffer.length,           // 文件大小
          undefined,               // 可选路径（非必须）
          buffer                   // 直接传入 buffer 内容
        );

  // 使用 sendFile 发送到目标群，并添加新的 caption
        const sentMsg = await client.sendFile(-4658228791, {
          file,
          caption: `channelOrderId：${channelOrderId}`
        });

        console.log(`[INFO] 图片+渠道单号已通过 sendFile 发送`);


        console.log(`[INFO] 渠道单号已发送至 -4658228791`);

        // 保存上下文（单个订单用）
        orderContextMap.set(sentMsg.id, {
          orderId,
          originalMsgId: message.id,
          fromChat: -4893629782
        });

      } catch (err) {
        console.error(`[ERROR] 请求接口失败:`, err.message);
      }
    }

    if (chatId === -4658228791 && message.replyTo && message.replyTo.replyToMsgId) {
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
  }, new NewMessage({}));

  // 防止退出
  setInterval(() => {}, 100000);
}

startOrderListener().catch(console.error);
