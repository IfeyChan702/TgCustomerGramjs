const { NewMessage } = require('telegram/events');
const axios = require('axios');

function setupTelegramListeners(client, {
  orderContextMap,
  sourceGroupIds,
  channelMap,
  channelGroupIds
}) {
  client.addEventHandler(async (event) => {
    const chatId = event.chatId?.valueOf();
    const message = event.message;

    // --- 标记渠道群 ---
    if (typeof message.message === 'string' && message.message.startsWith('此群渠道群ID设为')) {
      const match = message.message.match(/此群渠道群ID设为(\d+)/);
      if (match) {
        const channelId = match[1];
        channelMap.set(String(channelId), chatId);
        channelGroupIds.add(chatId);

        await client.sendMessage(chatId, {
          message: `渠道群绑定成功：channelId = ${channelId}`
        });
        console.log(`[INFO] 渠道群 ${chatId} 已标记为 channelId ${channelId}`);
      }
      return;
    }

    // --- 标记商户群 ---
    if (typeof message.message === 'string' && message.message.startsWith('此群标记为商户群')) {
      sourceGroupIds.add(chatId);

      await client.sendMessage(chatId, {
        message: `当前群 ${chatId} 已标记为商户群`
      });
      console.log(`[INFO] 群 ${chatId} 被标记为商户群`);
      return;
    }

    // --- 商户群监听接单 ---
    if (
      sourceGroupIds.has(chatId) &&
      message.media?.className === 'MessageMediaPhoto' &&
      typeof message.message === 'string' &&
      message.message.trim().length > 0
    ) {
      const orderId = message.message.trim();
      console.log(`[INFO] 检测到订单号: ${orderId}，请求接口中...`);

      try {
        const response = await axios.get('https://bi.humideah.com/bi/payin/check', {
          params: { order_id: orderId }
        });

        const channelId = response.data?.channel_id || '未获得到渠道ID';
        const channelOrderId = response.data?.channel_order_id || '未获取到渠道单号';
        const targetChatId = channelMap.get(String(channelId));

        if (!targetChatId) {
          console.warn(`[WARN] 未找到 channelId=${channelId} 对应的群`);
          return;
        }

        const sentMsg = await client.sendFile(targetChatId, {
          file: message.media,
          caption: `channelOrderId：${channelOrderId}`
        });

        console.log(`[INFO] 渠道单号已发送至 目标群`);

        orderContextMap.set(sentMsg.id, {
          orderId,
          originalMsgId: message.id,
          fromChat: chatId
        });
      } catch (err) {
        console.error(`[ERROR] 请求接口失败:`, err.message);
      }

      return;
    }

    // --- 渠道群回复监听 ---
    if (channelGroupIds.has(chatId) && message.replyTo?.replyToMsgId) {
      const replyToId = message.replyTo.replyToMsgId;
      const context = orderContextMap.get(replyToId);

      if (context) {
        const replyContent = message.text || '';

        await client.sendMessage(context.fromChat, {
          message: replyContent,
          replyTo: context.originalMsgId
        });

        console.log(`[INFO] 回复已转发回原群 ${context.fromChat}`);
        orderContextMap.delete(replyToId);
      } else {
        console.warn(`[WARN] 未找到上下文，replyToMsgId=${replyToId}`);
      }
    }
  }, new NewMessage({}));
}

module.exports = { setupTelegramListeners };
