const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Api } = require('telegram');
const { startRedis, redis } = require("../models/redisModel");
const axios = require('axios');
const tgDbService = require("./tgDbService");

const orderContextMap = new Map();
const clients = [];
const ErrorGroupChatID = -4750453063;

// 启动所有账户监听
async function startOrderListener() {
  const registerIds = await tgDbService.getLatestRegisterIds();
  const accountDetails = await tgDbService.getAccountByRegisterIdArray(registerIds);

  const isMissingValues = accountDetails.some(acc => !acc.session || !acc.api_id || !acc.api_hash);
  if (isMissingValues) {
    console.error(`[ERROR] 无法启动监听，registerId 数据不完整`);
    return;
  }

  for (const acc of accountDetails) {
    const client = new TelegramClient(
      new StringSession(acc.session),
      Number(acc.api_id),
      acc.api_hash,
      { connectionRetries: 5 }
    );
    await client.connect();
    console.log(`[INFO] Client connected: ${acc.api_id}`);
    setupEventHandlers(client);
    // 防止进程自动退出
    setInterval(() => {}, 100000);
    clients.push({ id: acc.Id, client });
  }

  console.log("[Telegram] 所有账号监听已启动");
}

startOrderListener().catch(console.error);

// ================= 监听事件主逻辑 ===================
function setupEventHandlers(client) {
  client.addEventHandler(async (event) => {
    try {
      await handleEvent(client, event);
    } catch (e) {
      console.error('[EventHandler Error]', e);
    }
  }, new NewMessage({}));
}

async function handleEvent(client, event) {
  const chatId = event.chatId?.valueOf();
  const chat = await client.getEntity(chatId);
  const chatTitle = chat.title;
  const message = event.message;
  const me = await event._client.getMe();
  const meId = String(me.id);
  const sender = await event.message.senderId;
  const senderTelegramID = String(sender);

  // ----------- 1. 标记渠道群 -----------
  if (
    meId === senderTelegramID &&
    typeof message.message === 'string' &&
    message.message.startsWith('此群渠道群ID设为') &&
    message.message.includes("监听")
  ) {
    await handleMarkChannelGroup(client, chatId, chatTitle, message.message);
    return;
  }

  // ----------- 2. 标记商户群 -----------
  if (
    meId === senderTelegramID &&
    typeof message.message === 'string' &&
    message.message.startsWith('此群标记为商户群') &&
    message.message.includes("监听")
  ) {
    await handleMarkMerchantGroup(client, chatId, chatTitle, message.message);
    return;
  }

  // ----------- 3. 来源群监听，转发带订单图片 -----------
  if (
    message.media?.className === 'MessageMediaPhoto' &&
    typeof message.message === 'string' &&
    message.message.trim().length > 0
  ) {
    await handleMerchantOrderMessage(client, chatId, message, chatTitle);
    return;
  }

  // ----------- 4. 渠道群回复监听，转发回商户群 -----------
  if (message.replyTo && message.replyTo.replyToMsgId) {
    await handleChannelReply(client, chatId, chatTitle, message);
    return;
  }
}

// =================== 标记渠道群 =====================
async function handleMarkChannelGroup(client, chatId, chatTitle, text) {
  const match = text.match(/此群渠道群ID设为(\d+)由(.+?)监听/);
  if (!match) return;
  const channelId = match[1];
  const accountId = match[2];

  // 检查唯一性
  if (
    await tgDbService.getGroupAccountChannelCount(channelId, accountId) !== 0 ||
    await tgDbService.getGroupIdChannelCount(channelId) !== 0 ||
    await tgDbService.getChannelChatIdCountExcludingAccount(chatId, accountId) !== 0
  ) {
    await client.sendMessage(chatId, { message: `渠道ID/ChatID 重复或已绑定` });
    console.log(`渠道ID/ChatID 重复或已绑定`);
    return;
  }

  await tgDbService.insertGroupChannel(accountId, String(channelId), chatId, chatTitle, "channel", 1);
  await client.sendMessage(chatId, { message: `渠道群绑定成功：渠道Id = ${channelId}, 由 ${accountId} 机器人监听` });
  console.log(`[INFO] 渠道群 ${chatId} 已标记为 channelId ${channelId}, 由 ${accountId} 机器人监听`);
}

// =================== 标记商户群 =====================
async function handleMarkMerchantGroup(client, chatId, chatTitle, text) {
  const match = text.match(/此群标记为商户群由(.+?)监听/);
  if (!match) return;
  const accountId = match[1];

  // 检查 chatId 唯一性
  if (await tgDbService.getMerchantChatIdCountExcludingAccount(chatId, accountId) !== 0) {
    await client.sendMessage(chatId, { message: `请勿重复绑定` });
    console.log(`请勿重复绑定`);
    return;
  }

  await tgDbService.insertGroupMerchant(accountId, chatId, chatTitle, "merchant", 1);
  await client.sendMessage(chatId, { message: ` 当前群 ${chatId} 已标记为商户群, 由 ${accountId} 机器人监听` });
  console.log(`[INFO] 群 ${chatId} 被标记为商户群, 由 ${accountId} 机器人监听`);
}

// ========== 来源群订单消息处理 ============
async function handleMerchantOrderMessage(client, chatId, message, chatTitle) {
  // 判断是否来源有效商户群 & 账号
  const relevantAccountIds = await tgDbService.getAccountIdsByChatIdInMerchant(chatId);
  const me = await client.getMe();
  const accountIdFromClient = await tgDbService.getAccountIdByTelegramId(String(me.id));
  const sourceGroupIds = await tgDbService.getAllChatIdsInMerchant();

  if (!sourceGroupIds.has(String(chatId)) || !relevantAccountIds.has(accountIdFromClient)) return;

  const orderId = message.message.trim();
  console.log(`[INFO] 检测到订单号: ${orderId}，请求接口中...`);
  try {
    const response = await axios.get('https://bi.humideah.com/bi/payin/check', {
      params: { order_id: orderId }
    });
    const channelId = response.data?.channel_id || '未获得到渠道ID';
    const channelOrderId = response.data?.channel_order_id || '未获取到渠道单号';
    const targetChatIds = await tgDbService.getChatIdsByChannelIdInChannel(String(channelId));

    if (!targetChatIds.length) {
      await client.sendMessage(ErrorGroupChatID, { message: `[WARN] 未找到 channelId=${channelId} 对应的群` });
      return;
    }
    // 群发图片
    for (const targetChatId of targetChatIds) {
      try {
        const sentMsg = await client.sendFile(targetChatId, {
          file: message.media,
          caption: `${channelOrderId}`
        });
        orderContextMap.set(sentMsg.id, {
          orderId,
          originalMsgId: message.id,
          fromChat: chatId
        });
        console.log(`Sent to ${targetChatId}:`, sentMsg.id);
      } catch (err) {
        console.error(`Failed to send to ${targetChatId}:`, err.message);
      }
    }
    console.log(`[INFO] 渠道单号已发送至目标群`);
  } catch (err) {
    console.error(`[ERROR] 请求接口失败:`, err.message);
  }
}

// ========== 渠道群回复监听 → 回转商户群 ============
async function handleChannelReply(client, chatId, chatTitle, message) {
  const channelGroupIds = await tgDbService.getAllChatIdsInChannel();
  if (!channelGroupIds.has(String(chatId))) return;

  const replyToId = message.replyTo.replyToMsgId;
  const context = orderContextMap.get(replyToId);

  if (context) {
    const replyContent = message.text || '';
    const replyText = await tgDbService.getReplyText(replyContent);

    if (replyText === null) {
      await client.sendMessage(ErrorGroupChatID, {
        message: `语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`,
      });
      console.log(`语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`);
    }
    await client.sendMessage(context.fromChat, {
      message: replyText !== null ? replyText : replyContent,
      replyTo: context.originalMsgId
    });
    console.log(`[INFO] 回复已转发回原群 ${context.fromChat} 并引用消息 ${context.originalMsgId}`);
    // orderContextMap.delete(replyToId);
  } else {
    console.warn(`[WARN] 未找到关联上下文，replyToMsgId: ${replyToId}`);
  }
}

// =================== 动态启动/停止 ===============
async function stopListener(id) {
  const clientEntry = clients.find(entry => entry.id === id);
  if (!clientEntry) {
    console.warn(`用户不存在: ${id}`);
    return;
  }
  try {
    await clientEntry.client.disconnect();
    removeClientById(id);
    console.log(`用户连接断开: ${id}`);
  } catch (err) {
    console.error(`断开失败 ${id}:`, err);
  }
}

async function startListener(id) {
  const data = await tgDbService.getAccountById(id);
  const client = new TelegramClient(
    new StringSession(data.session),
    Number(data.api_id),
    data.api_hash,
    { connectionRetries: 5 }
  );
  await client.connect();
  console.log(`用户连接成功: ${data.api_id}`);
  setupEventHandlers(client);
  clients.push({ id: data.Id, client });
}

function removeClientById(id) {
  const idx = clients.findIndex(entry => entry.id === id);
  if (idx !== -1) {
    clients.splice(idx, 1);
    console.log(`用户被移除 ${id}`);
  } else {
    console.warn(`用户未找到 ${id}`);
  }
}

// =================== 模块导出 ====================
module.exports = {
  startListener,
  stopListener
};
