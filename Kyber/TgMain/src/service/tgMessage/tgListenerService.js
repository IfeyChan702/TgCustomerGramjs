const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const tgDbService = require("../tgDbService");
const { getOrRunMessageResponse, onceByKey } = require("../../utils/lockUtil");
const { redis } = require("../../models/redisModel");
const handleOrder = require("../handle/handleOrder");
const handleRate = require("../handle/handleRate");
const handleSuccess = require("../handle/handleSuccess");
const tgMsgHandle = require("../tgMessage/tgMsgHandService");

const clients = [];
const ErrorGroupChatID = -4750453063;
const orderChatId = -4856325360;//线上的命令群
const MAX_THREAD_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// 允许使用 success 命令的群
const ALLOWED_SUCCESS_CHAT_IDS = new Set([
  "-4750453063",
  "-977169962",
  "-1001583412817"
]);

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
    setupEventHandlers(client, acc.is_running);
    // 防止进程自动退出
    setInterval(() => {
    }, 100000);
    clients.push({ id: acc.Id, client });
  }
  console.log("[Telegram] 所有账号监听已启动");
}

startOrderListener().catch(console.error);

// ================= 监听事件主逻辑 ===================
function setupEventHandlers(client, isRunning) {
  client.addEventHandler(async (event) => {
    try {
      await handleEvent(client, event, isRunning);
    } catch (e) {
      console.error("[EventHandler Error]", e);
    }
  }, new NewMessage({}));
}

async function handleEvent(client, event, isRunning) {
  const chatId = event.chatId?.valueOf();
  const chat = await client.getEntity(chatId);
  const chatTitle = chat.title;
  const message = event.message;
  const me = await event._client.getMe();
  const meId = String(me.id);
  const sender = await event.message.senderId;
  const senderTelegramID = String(sender);
  const orderRegex = /\b[\dA-Za-z]{10,30}\b/;

  //TODO 逻辑可能有问题
  if (2 === isRunning) {
    await tgMsgHandle.recMsg(client, event);
    return;
  }

  // ----------- 命令查询“未处理”的订单 -----------
  if (typeof message.message === "string"
  ) {
    //0是关闭，1是开启
    //orderChatId
    //TODO 这里的条件可能需要更改，（权限限添加之类的、或者是特定的群组）
    if (chatId === orderChatId) {
      if (message.message === "/未处理") {
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleNoProOrder(client, chatId, message);
        });
        return;
      }
      if (/^\/已处理[：:]/.test(message.message)) {
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleProOrder(client, chatId, message);
        });
        return;
      }
    }

    if (message.message === "/hello_chatId") {
      await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
        await handleChatIdOrder(client, chatId, message, chatTitle, chat);
      });
      return;
    }

    if (chatId === ErrorGroupChatID) {
      if (message.message === "/start") {
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStartOrStopOrder(client, chatId, true, 0);
        });
        return;
      }


      if (message.message.startsWith("/start_")) {
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStartOrderByID(client, chatId, message);
        });
        return;
      }

      if (message.message === "/stop") {
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStartOrStopOrder(client, chatId, false, 1);
        });
        return;
      }
      if (message.message.startsWith("/stop_")) {
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStopOrderByID(client, chatId, message);
        });
        return;
      }
    }

    if (message.message.startsWith("/success1")) {
      // 群校验
      if (!ALLOWED_SUCCESS_CHAT_IDS.has(String(chatId))) {
        await client.sendMessage(chatId, { message: "❌ 本群无权使用 /success1" });
        return;
      }

      const minutes = parseInt(message.message.replace("/success1", ""), 10) || 10;
      await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
        await handleSuccess.requestUrl(client, chatId, minutes);
      });
      return;
    }

    if (message.message.startsWith("/success2")) {
      // 群校验
      if (!ALLOWED_SUCCESS_CHAT_IDS.has(String(chatId))) {
        await client.sendMessage(chatId, { message: "❌ 本群无权使用 /success2" });
        return;
      }

      const minutes = parseInt(message.message.replace("/success2", ""), 10) || 10;
      await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
        await handleRate.requestUrl(client, chatId, minutes);
      });
      return;
    }

    if (message.message.startsWith("/")) {
      await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
        const parts = message.message.trim().split(/\s+/);
        const identifier = parts[0].replace("/", "");
        const userArgs = parts.slice(1);
        const command = await tgDbService.getCommandByIdentifier(identifier);
        if (!command) {
          console.warn(`命令${message.message} 不存在`);
          return false;
        }
        if (await isAuthorized(command, chatId)) {
          if (command.url.includes("adm.gamecloud.vip")) {
            console.log("这个命令是调用军哥支付平台的接口:", command.url);
            /*await handleOrder.requestErsanUrl(command, userArgs, message.message, client, chatId);*/
            return true;
          } else {
            await handleOrder.requestUrl(command, userArgs, message.message, client, chatId);
          }
        }
      });
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
    message.message.trim().length > 0 &&
    orderRegex.test(message.message)
  ) {
    await getOrRunMessageResponse(redis, chatId, message.id, 60, async () => { // 60秒足够
      await handleMerchantOrderMessage(client, chatId, message);
    });
    return;
  }

  // ----------- 4. 渠道群回复监听，转发回商户群 -----------
  if (message.replyTo && message.replyTo.replyToMsgId) {
    await getOrRunMessageResponse(redis, chatId, message.id, 60, async () => {
      await handleChannelReply(client, chatId, chatTitle, message);
    });
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

  const srcKey = `srcfwd:${chatId}:${message.id}`;
  const isFirstForSource = await onceByKey(redis, srcKey, 0);
  if (!isFirstForSource) {
    // 这条来源消息以前转发过了，直接跳过（哪怕过去一个月）
    return;
  }

  await client.sendMessage(chatId, {
    message: "请稍等，现在为您查询订单",
    replyTo: message.id
  });

  const orderId = message.message.trim();
  console.log(`[INFO] 检测到订单号: ${orderId}，请求接口中...`);
  try {

    let response;
    let source = "bi";

    try {

      response = await axios.get("https://bi.sompay.xyz/bi/payin/check", {
        params: { order_id: orderId },
        timeout: 5000
      });

      if (!response.data || !response.data.channel_id) {
        throw new Error("第一个接口数据无效");
      }

    } catch (err) {
      console.warn(`[WARN] 第一个接口失败:${err.message}，尝试备用接口...`);
      source = "gameCloud";

      const token = await handleOrder.getErsanToken(redis);

      if (!token) {
        console.warn("没有可用的 token，无法请求接口");
        return;
      }
      console.log(`handleMerchantOrderMessage,调用登录接口的token=${token}`);
      response = await axios.get(
        `https://api.gamecloud.vip/admin-api/plt/order-in/get/${orderId}`,
        {
          headers: {
            "tenant-id": "1",
            Authorization: `Bearer ${token}`
          },
          timeout: 8000
        }
      );
    }

    const raw = response.data || {};
    const data = raw.data || raw;
    if (data.data === null) {
      console.error(`data=null,response=${response}`);
      return;
    }
    const channelId = data.channel_id || data.channelId || "未获得到渠道ID";
    const channelName = data.channel_name || data.channelName || "未知渠道";
    const merchantOrderId = data.merchantOrderId || data.merchantOrderNo || "未知商户订单号";
    const orderNo = data.orderId || data.orderNo || "未知平台订单号";
    const channelOrderNo = data.channel_order_id || data.channelOrderNo || "未知渠道订单号";
    const status = data.payResult || data.statusDesc || "未知状态";

    const targetChatIds = await tgDbService.getChatIdsByChannelIdInChannel(String(channelId));

    if (!targetChatIds.length) {
      await client.sendMessage(orderChatId, { message: `[WARN] 未找到 channelId=${channelId} 对应的群` });
      const errorSentMsg = await client.sendFile(orderChatId, {
        file: message.media,
        caption: `${orderNo}`
      });
      await addOrUpdateOrder(errorSentMsg.id, message.id, chatId, channelId, orderNo);
      return;
    }
    // 群发图片
    for (const targetChatId of targetChatIds) {
      try {
        const sentMsg = await client.sendFile(targetChatId, {
          file: message.media,
          caption: `${orderNo}`
        });

        await addOrUpdateOrder(sentMsg.id, message.id, chatId, channelId, orderNo);

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
  try {
    const channelGroupIds = await tgDbService.getAllChatIdsInChannel();
    if (!channelGroupIds.has(String(chatId))) return;

    const replyToId = message.replyTo?.replyToMsgId;
    if (!replyToId) return;

    console.log(`[DEBUG] 收到回复消息 msgId:${message.id}, replyToId:${replyToId}, 群:${chatTitle}(${chatId})`);

    const replyKey = `replyfwd:${chatId}:${message.id}`;
    const ok = await onceByKey(redis, replyKey, 60 * 60 * 24 * 30);
    if (!ok) return;

    //做一个“时效窗口”防止离线历史消息回放
    const now = Date.now();
    const msgTs = getMsgTimestampMillis(message);
    if (now - msgTs > MAX_THREAD_AGE_MS) return;

    const context = await tgDbService.getOrderByChannelMsgId(replyToId);
    //const context = orderContextMap.get(replyToId);
    console.log(`[DEBUG] 查询上下文 replyToId:${replyToId}, context:${JSON.stringify(context)}`);

    if (context && context.merchant_msg_id && context.merchant_chat_id) {
      const replyContent = (message.message || "").trim();
      if (!replyContent) return;
      const replyText = await tgDbService.getReplyText(replyContent);
      let replyId = null;

      if (replyText === null) {
        await client.sendMessage(orderChatId, {
          message: `语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`
        });
        console.log(`语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`);
      } else {
        replyId = replyText.id;
        console.log(`[DEBUG] 语料库匹配 replyId:${replyId}, 原文:"${replyContent}" → 回复:"${replyText.reply_text}", 目标群:${context.merchant_chat_id}, 目标消息:${context.merchant_msg_id}`);
        await client.sendMessage(BigInt(context.merchant_chat_id), {
          message: replyText.reply_text,
          replyTo: Number(context.merchant_msg_id)
        });
        console.log(`[INFO] 回复已转发回原群 ${context.merchant_chat_id} 并引用消息 ${context.merchant_msg_id}`);
        await tgDbService.updateOrderStatusByChannelMsgId(replyToId, replyId);
      }
    } else {
      console.warn(`[WARN] 未找到关联上下文，replyToMsgId: ${replyToId}`);
    }
  } catch (err) {
    console.error(`handleChannelReply:`, err);
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
  setupEventHandlers(client, data.is_running);
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
 * 群的权限处理
 * @param command
 * @param chatId
 * @returns {*}
 */
async function isAuthorized(command, chatId) {
  try {

    if (command.allow_all === 1) {
      return true;
    }

    return await tgDbService.isGroupAllowedForCommand(command.id, chatId);

  } catch (err) {
    console.error(`isAuthorized 报错:`, err);
    return false;
  }
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
  }
}

/**
 * 处理订单状态为0，并转发
 * @param client
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function handleNoProOrder(client, chatId, message) {

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

  text += `\n 使用命令"/已处理:"+订单号，可以完成订单处理`;

  await client.sendMessage(chatId, {
    message: text,
    replyTo: message.id
  });
}

/**
 * 处理"订单已完成"
 * @param client
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function handleProOrder(client, chatId, message) {
  const parts = message.message.replace(/：/g, ":").split(":");
  const orderId = parts.slice(1).join(":").trim();

  if (!orderId) {
    await client.sendMessage(chatId, {
      message: "❌ 订单号格式错误，请使用 /已处理:订单号",
      replyTo: message.id
    });
    return;
  }

  const result = await tgDbService.checkAndProcessOrder(orderId);

  if (!result.found) {
    await client.sendMessage(chatId, {
      message: `⚠️ 未找到订单号 ${orderId}，请确认是否正确。`,
      replyTo: message.id
    });
  } else if (result.alreadyProcessed) {
    await client.sendMessage(chatId, {
      message: `✅ 订单 ${orderId} 共 ${result.total} 条记录，全部已处理过，无需重复操作。`,
      replyTo: message.id
    });
  } else if (result.updated) {
    const msg = result.alreadyProcessedCount > 0
      ? `✅ 订单 ${orderId} 共 ${result.total} 条记录，本次处理 ${result.updatedCount} 条，之前已处理 ${result.alreadyProcessedCount} 条。`
      : `✅ 订单 ${orderId} 共 ${result.total} 条记录，已全部标记为已处理！`;
    await client.sendMessage(chatId, {
      message: msg,
      replyTo: message.id
    });
  } else {
    await client.sendMessage(chatId, {
      message: `❗ 订单 ${orderId} 标记失败，请稍后重试。`,
      replyTo: message.id
    });
  }
}

/**
 * 处理"/start"命令
 * @returns {Promise<void>}
 */
async function handleStartOrStopOrder(client, chatId, isStart, isRunning) {
  try {
    const availableAcc = await tgDbService.getAccountByIsRunning(isRunning);

    if (!availableAcc || availableAcc.length === 0) {
      //TODO 这里有一个问题如果是全部的的账户都关闭了，就无法发送消息
      if (!isStart) {
        return;
      }
      const message = isStart
        ? "⚠️ 所有账号都已经开启！"
        : "⚠️ 所有账号都已经关闭！";
      return client.sendMessage(chatId, {
        message: message
      });
    }

    const actionText = isStart ? "未开启" : "已开启";
    const commandPrefix = isStart ? "start_" : "stop_";

    let msg = `${actionText}的用户列表：\n\n`;
    availableAcc.forEach((acc, idx) => {
      msg += `${idx + 1}. 用户ID：${acc.id}\n`;
    });

    msg += `\n💡 请输入 "${commandPrefix}"+用户ID 来${isStart ? "开启" : "关闭"}该用户`;

    await client.sendMessage(chatId, {
      message: msg
    });

  } catch (err) {
    console.error(`[ERROR] 处理 ${isStart ? "开启" : "关闭"}用户列表失败:`, err);
    await client.sendMessage(chatId, {
      message: `系统错误，无法获取账号列表。`
    });
  }
}

/**
 * 处理"/start_"+id的命令
 * @param client
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function handleStartOrderByID(client, chatId, message) {
  try {
    const parts = message.message?.split("_");
    if (!parts || parts.length < 2) {
      return client.sendMessage(chatId, {
        message: `开启用户指令错误,"/start_"+用户id`
      });
    }
    const accId = message.message.split("_")[1].trim();
    if (await tgDbService.isAccountExistsWithStatus(accId, 0)) {
      await tgDbService.updateRunningByAccId(accId, 1);
      await startListener(accId);
      client.sendMessage(chatId, {
        message: `开启成功，用户${accId}成功开启`
      });
      return;
    }
    client.sendMessage(chatId, {
      message: `开启失败，用户${accId}已经是开启状态`
    });
  } catch (e) {
    console.log(`[ERROR] 开启用户失败`);
  }
}

/**
 * 处理"/stop_"+id的命令
 * @param client
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function handleStopOrderByID(client, chatId, message) {
  try {
    const parts = message.message?.split("_");
    if (!parts || parts.length < 2) {
      return client.sendMessage(chatId, {
        message: `关闭用户指令错误，应为 "/stop_"+用户id`
      });
    }

    const accId = parts[1].trim();

    const isRunning = await tgDbService.isAccountExistsWithStatus(accId, 1);
    if (!isRunning) {
      return client.sendMessage(chatId, {
        message: `⚠️ 用户 ${accId} 当前未运行，无需关闭`
      });
    }

    const runningAccounts = await tgDbService.getAccountByIsRunning(1);
    if (runningAccounts.length <= 1) {
      return client.sendMessage(chatId, {
        message: `❌ 只剩下最后一个正在运行的用户，无法关闭`
      });
    }

    await tgDbService.updateRunningByAccId(accId, 0);
    await stopListener(accId); // 如果你有 stopListener 函数，这里调用

    return client.sendMessage(chatId, {
      message: `✅ 用户 ${accId} 已成功关闭`
    });

  } catch (e) {
    console.error(`[ERROR] 关闭用户失败:`, e);
    return client.sendMessage(chatId, {
      message: `系统错误，关闭用户失败：${e.message || e}`
    });
  }
}

/**
 * 处理"/chatId"的命令
 * @param client
 * @param chatId
 * @param message
 * @param chatTitle
 * @param chat
 * @returns {Promise<void>}
 */
async function handleChatIdOrder(client, chatId, message, chatTitle, chat) {
  try {
    let type = "未知类型";
    let chatClassName = chat.className;
    if (chatClassName === "User") {
      type = "私聊";
    } else if (chatClassName === "Channel") {
      type = chat.megagroup ? "超级群组" : (chat.broadcast ? "频道" : "普通频道");
    } else if (chatClassName === "Chat") {
      type = "普通群组";
    }

    const chatIdDis = typeof chatId === "object" ? JSON.stringify(chatId) : chatId.toString();
    const text = `📨 当前聊天信息：
        - chatId: ${chatIdDis}
        - 类型: ${type}
        - 名称: ${chatTitle || "（无标题）"}`;

    await client.sendMessage(chatId, {
      message: text
    });
  } catch (e) {
    console.error(`[ERROR] 处理命令"/chatId"故障:`, e);
    return client.sendMessage(chatId, {
      message: `系统错误，"/chatId"命令处理失败`
    });
  }
}

function getMsgTimestampMillis(message) {
  if (!message || message.date == null) return 0;
  const d = message.date;
  if (typeof d === "number") {
    // Telegram 通常是秒级时间戳，若值较小则乘以 1000
    return d < 1e12 ? d * 1000 : d;
  }
  if (typeof d.getTime === "function") return d.getTime();
  return 0;
}

// =================== 模块导出 ====================
module.exports = {
  startListener,
  stopListener
};
