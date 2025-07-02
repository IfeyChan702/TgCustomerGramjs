const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { Api } = require("telegram");
const { Markup } = require("telegram");
const { startRedis, redis } = require("../models/redisModel");
const axios = require("axios");
const tgDbService = require("./tgDbService");
const { getOrderByChannelMsgId } = require("./tgDbService");
const { off } = require("process");
const { call } = require("express");
const { withRedisLock } = require("../utils/lockUtil");

const clients = [];
const ErrorGroupChatID = -4750453063;
const ADMIN_USER_IDS = ["12345678"];

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
    setInterval(() => {
    }, 100000);
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
      console.error("[EventHandler Error]", e);
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
  const data = event.data?.toString();

  // ----------- 命令查询“未处理”的订单 -----------
  if (typeof message.message === "string"
  ) {
    //0是关闭，1是开启
    //orderChatId
    if (chatId === ErrorGroupChatID) {
      if (message.message === "/未处理") {
        await withRedisLock(redis, `lock:noproc:${chatId},${message.id}`, 10, async () => {
          await handleNoProOrder(client, chatId, message,senderTelegramID);
        });
        return;
      }

      if (message.message.startsWith("/已处理:")) {
        await withRedisLock(redis, `lock:proc:${chatId}`, 10, async () => {
          await handleProOrder(client, chatId, message);
        });
        return;
      }

      //TODO 这里需要更改一下，测试的时候不用,这里的if之后可能也需要更改一下
      if (!isAuthorized(sender)) {
        if (message.message === "/start") {
          await handleStartOrder(client, chatId);
          return;
        }

        if (message.message.startsWith("/start_")) {
          await handleStartOrderByID(client, chatId, message);
          return;
        }

        if ("/stop") {
          await handleStopOrder();
          return;
        }
      }

    }

  }

  // ----------- 1. 标记渠道群 -----------
  if (
    meId === senderTelegramID &&
    typeof message.message === "string" &&
    message.message.startsWith("此群渠道群ID设为") &&
    message.message.includes("监听")
  ) {
    await handleMarkChannelGroup(client, chatId, chatTitle, message.message);
    return;
  }

  // ----------- 2. 标记商户群 -----------
  if (
    meId === senderTelegramID &&
    typeof message.message === "string" &&
    message.message.startsWith("此群标记为商户群") &&
    message.message.includes("监听")
  ) {
    await handleMarkMerchantGroup(client, chatId, chatTitle, message.message);
    return;
  }

  // ----------- 3. 来源群监听，转发带订单图片 -----------
  if (
    message.media?.className === "MessageMediaPhoto" &&
    typeof message.message === "string" &&
    message.message.trim().length > 0
  ) {
    await handleMerchantOrderMessage(client, chatId, message);
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
async function handleMerchantOrderMessage(client, chatId, message) {
  // 判断是否来源有效商户群 & 账号
  const relevantAccountIds = await tgDbService.getAccountIdsByChatIdInMerchant(chatId);
  const me = await client.getMe();
  const accountIdFromClient = await tgDbService.getAccountIdByTelegramId(String(me.id));
  const sourceGroupIds = await tgDbService.getAllChatIdsInMerchant();

  if (!sourceGroupIds.has(String(chatId)) || !relevantAccountIds.has(accountIdFromClient)) return;

  await client.sendMessage(chatId, {
    message: "客户请等待，现在为你查询订单",
    replyTo: message.id
  });

  const orderId = message.message.trim();
  console.log(`[INFO] 检测到订单号: ${orderId}，请求接口中...`);
  try {
    const response = await axios.get("https://bi.sompay.xyz/bi/payin/check", {
      params: { order_id: orderId }
    });
    const channelId = response.data?.channel_id || "未获得到渠道ID";
    const merchantOrderId = response.data?.orderId;
    const targetChatIds = await tgDbService.getChatIdsByChannelIdInChannel(String(channelId));

    if (!targetChatIds.length) {
      await client.sendMessage(ErrorGroupChatID, { message: `[WARN] 未找到 channelId=${channelId} 对应的群` });
      const errorSentMsg = await client.sendFile(ErrorGroupChatID, {
        file: message.media,
        caption: `${merchantOrderId}`
      });
      await addOrUpdateOrder(errorSentMsg.id, message.id, chatId, channelId, merchantOrderId);
      return;
    }
    // 群发图片
    for (const targetChatId of targetChatIds) {
      try {
        const sentMsg = await client.sendFile(targetChatId, {
          file: message.media,
          caption: `${merchantOrderId}`
        });

        await addOrUpdateOrder(sentMsg.id, message.id, chatId, channelId, merchantOrderId);

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
  const context = await tgDbService.getOrderByChannelMsgId(replyToId);
  //const context = orderContextMap.get(replyToId);

  if (context && context.merchant_msg_id && context.merchant_chat_id) {
    const replyContent = message.text || "";
    const replyText = await tgDbService.getReplyText(replyContent);
    let replyId = null;

    if (replyText === null) {
      await client.sendMessage(ErrorGroupChatID, {
        message: `语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`
      });
      console.log(`语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`);
    } else {
      replyId = replyText.id;
      await client.sendMessage(context.merchant_chat_id, {
        message: replyText.reply_text,
        replyTo: context.merchant_msg_id
      });
      console.log(`[INFO] 回复已转发回原群 ${context.fromChat} 并引用消息 ${context.originalMsgId}`);
      await tgDbService.updateOrderStatusByChannelMsgId(replyToId, replyId);
    }
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

/**
 * 权限处理
 * @param userId
 * @returns {*}
 */
function isAuthorized(userId) {
  return ADMIN_USER_IDS.includes(userId);
}

async function addOrUpdateOrder(channelMessageId, merchantMessageId, chatId, channelId, merchantOrderId) {
  try {
    const exist = await tgDbService.getOrderByMeChMoCo(chatId, channelId, merchantOrderId);
    if (!exist) {
      await tgDbService.insertOrderContext(channelMessageId, merchantMessageId, chatId, channelId, merchantOrderId);
      console.log(`[INFO] 插入新订单成功，商户ID: ${chatId}，订单: ${merchantOrderId}`);
    } else {
      await tgDbService.updateMsgIdsByOrderKey(channelMessageId, merchantMessageId, chatId, channelId, merchantOrderId);
      console.log(`[WARN] 订单已存在，跳过插入，更改订单，商户ID: ${chatId}，商户订单: ${merchantOrderId}`);
    }
  } catch (err) {
    console.error(" 插入 tg_order 失敗:", err.message);
    return;
  }
}

/**
 * 处理订单状态为0，并转发
 * @param client
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function handleNoProOrder(client, chatId, message,telegramId) {

  const orders = await tgDbService.getPendingOrders();

  if (!orders || orders.length === 0) {
    await client.sendMessage(chatId, {
      message: "当前没有未处理的订单",
      replyTo: message.id
    });
    return;
  }

  let text = `共取得${orders.length}等待处理订单：\n\n`;
  orders.forEach((order, index) => {
    text += `${index + 1}. 订单号：${order.merchant_order_id} \n`;
  });

  await client.sendMessage(chatId, {
    message: text,
    replyTo: message.id
  });
}

/**
 * 处理"订单已完成"
 * @param client
 * @param chatId
 * @param text
 * @returns {Promise<void>}
 */
async function handleProOrder(client, chatId, text) {
  const parts = text.split(":");
  const orderId = parts[1]?.trim();

  if (!orderId) {
    await client.sendMessage(chatId, {
      message: "❌ 订单号格式错误，请使用 /已处理:订单号",
      replyTo: replyToMessageId
    });
    return;
  }

  const result = await tgDbService.checkAndProcessOrder(orderId);

  if (!result.found) {
    await client.sendMessage(chatId, {
      message: `⚠️ 未找到订单号 ${orderId}，请确认是否正确。`,
      replyTo: replyToMessageId
    });
  } else if (result.alreadyProcessed) {
    await client.sendMessage(chatId, {
      message: `✅ 订单 ${orderId} 已经处理过了，无需重复操作。`,
      replyTo: replyToMessageId
    });
  } else if (result.updated) {
    await client.sendMessage(chatId, {
      message: `✅ 订单 ${orderId} 已成功标记为已处理！`,
      replyTo: replyToMessageId
    });
  } else {
    await client.sendMessage(chatId, {
      message: `❗ 订单 ${orderId} 标记失败，请稍后重试。`,
      replyTo: replyToMessageId
    });
  }
}

/**
 * 处理"/start"命令
 * @returns {Promise<void>}
 */
async function handleStartOrder(client, chatId) {
  //这里有问题
  const availableAcc = await tgDbService.getAccountByIsRunning(0);
  if (!availableAcc || availableAcc.length === 0) {
    await client.sendMessage(chatId, {
      message: "⚠️ 账号都已经开启！"
    });
    return;
  }
  let msg = "未开启的用户列表：\n\n";
  availableAcc.forEach((acc, idx) => {
    msg += `${idx + 1}.用户ID：${acc.id}\n`;
  });
  msg += `\n请输入"start_"+用户ID，就可以开启用户`;
  client.sendMessage(chatId, {
    message: msg
  });
}

/**
 *
 * @param client
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function handleStartOrderByID(client, chatId, message) {
  try {
    const accId = message.message.split("_")[1].trim();
    if (await tgDbService.isAccountExistsWithStatus(accId, 0)) {
      //TODO 这里可能需要再修改用户状态
      await startListener(accId);
      client.SendMessage(chatId, {
        message: `开启成功，用户${accId}成功开启`
      });
    }
    client.SendMessage(chatId, {
      message: `开启失败，用户${accId}已经是开启状态`
    });
  } catch (e) {
    console.log();
  }
}

/**
 * 处理"/stop"命令
 * @returns {Promise<void>}
 */
async function handleStopOrder() {

}

//
async function showConnectedTelegramUsers(client, chatId) {
  if (!clients || clients.length === 0) {
    await client.sendMessage(chatId, {
      message: "⚠️ 当前没有任何连接中的账号。"
    });
    return;
  }

  let text = "📡 当前连接中的 Telegram 用户列表：\n\n";

  for (const entry of clients) {
    try {
      const user = await entry.client.getMe();
      text += `🟢 ID: ${user.id}\n`;
      text += `👤 名称: ${user.firstName ?? ""} ${user.lastName ?? ""}\n`;
      text += `📛 用户名: @${user.username ?? "（无）"}\n`;
      text += `🆔 本地标识: ${entry.id}\n`;
      text += `──────────────\n`;
    } catch (err) {
      text += `⚠️ 无法获取账号 ID ${entry.id} 的信息（连接异常）\n──────────────\n`;
    }
  }

  await client.sendMessage(chatId, {
    message: text.trim()
  });
}


// =================== 模块导出 ====================
module.exports = {
  startListener,
  stopListener
};
