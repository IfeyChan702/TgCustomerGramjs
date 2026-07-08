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
const orderQuery = require("../handle/orderQueryService");
const tgMsgHandle = require("../tgMessage/tgMsgHandService");

const clients = [];
const ErrorGroupChatID = -4750453063;
const orderChatId = -4856325360;//线上的命令群
const MAX_THREAD_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const orderRegex = /[A-Za-z0-9_-]{10,30}/;
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
  const seenMsgKeys = new Set();
  client.addEventHandler(async (event) => {
    const key = `${event.chatId}:${event.message?.id}`;
    console.log(`[setupEventHandlers] key=${key} seen=${seenMsgKeys.has(key)}`);
    if (seenMsgKeys.has(key)) return;
    seenMsgKeys.add(key);
    setTimeout(() => seenMsgKeys.delete(key), 30000);
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

  console.log('╔═══════════════════════════════════════════════');
  console.log('║ 新消息进来');
  console.log('║ Chat ID     :', event.chatId?.toString?.() || '未知');
  console.log('║ From ID     :', message.senderId?.toString?.() || '未知');
  console.log('║ Msg ID      :', message.id);
  console.log('║ Is reply?   :', !!message.replyTo);
  if (message.replyTo) {
    console.log('║   ↳ Reply to Msg ID :', message.replyTo.replyToMsgId);
    console.log('║   ↳ Reply to top ID :', message.replyTo.replyToTopId);
  }
  console.log('║ Date        :', new Date(message.date * 1000).toISOString());
  console.log('║ Text length :', message.message?.length || 0);
  if (message.message?.trim()) {
    console.log('║ Text preview:', message.message.trim().slice(0, 120) + (message.message.length > 120 ? '...' : ''));
  }
  if (message.media) {
    console.log('║ Has media   :', message.media.className);
  }
  console.log('╚═══════════════════════════════════════════════');

  console.log(`[handleEvent] 开始处理 chatId:${chatId} title:"${chatTitle}" isRunning:${isRunning} meId:${meId} senderId:${senderTelegramID}`);

  // ----------- isRunning=2：转发给 recMsg -----------
  if (2 === isRunning) {
    console.log(`[handleEvent] → isRunning=2，转交 tgMsgHandle.recMsg 处理`);
    await tgMsgHandle.recMsg(client, event);
    return;
  }

  // ----------- 命令查询"未处理"的订单 -----------
  if (typeof message.message === "string") {
    console.log(`[handleEvent] 文本消息，开始命令匹配 text:"${message.message.slice(0, 60)}"`);

    if (chatId === orderChatId) {
      if (message.message === "/未处理") {
        console.log(`[handleEvent] → 命令：/未处理`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleNoProOrder(client, chatId, message);
        });
        return;
      }
      if (/^\/已处理[：:]/.test(message.message)) {
        console.log(`[handleEvent] → 命令：/已处理`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleProOrder(client, chatId, message);
        });
        return;
      }
      if (message.message === "/矛盾") {
        console.log(`[handleEvent] → 命令：/矛盾`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleConflictList(client, chatId, message);
        });
        return;
      }
      if (/^\/矛盾处理[：:]/.test(message.message)) {
        console.log(`[handleEvent] → 命令：/矛盾处理`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleConflictResolve(client, chatId, message);
        });
        return;
      }
    }

    if (message.message === "/hello_chatId") {
      console.log(`[handleEvent] → 命令：/hello_chatId`);
      await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
        await handleChatIdOrder(client, chatId, message, chatTitle, chat);
      });
      return;
    }

    if (chatId === ErrorGroupChatID) {
      if (message.message === "/start") {
        console.log(`[handleEvent] → 命令：/start`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStartOrStopOrder(client, chatId, true, 0);
        });
        return;
      }
      if (message.message.startsWith("/start_")) {
        console.log(`[handleEvent] → 命令：/start_id`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStartOrderByID(client, chatId, message);
        });
        return;
      }
      if (message.message === "/stop") {
        console.log(`[handleEvent] → 命令：/stop`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStartOrStopOrder(client, chatId, false, 1);
        });
        return;
      }
      if (message.message.startsWith("/stop_")) {
        console.log(`[handleEvent] → 命令：/stop_id`);
        await getOrRunMessageResponse(redis, chatId, message.id, 60 * 10, async () => {
          await handleStopOrderByID(client, chatId, message);
        });
        return;
      }
    }

    if (message.message.startsWith("/success1")) {
      console.log(`[handleEvent] → 命令：/success1`);
      if (!ALLOWED_SUCCESS_CHAT_IDS.has(String(chatId))) {
        console.warn(`[handleEvent] ❌ /success1 群(${chatId})无权限`);
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
      console.log(`[handleEvent] → 命令：/success2`);
      if (!ALLOWED_SUCCESS_CHAT_IDS.has(String(chatId))) {
        console.warn(`[handleEvent] ❌ /success2 群(${chatId})无权限`);
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
      console.log(`[handleEvent] → 自定义命令匹配：${message.message.split(" ")[0]}`);
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

    console.log(`[handleEvent] 文本消息未命中任何命令，继续向下匹配`);
  }

  // ----------- 1. 标记渠道群 -----------
  console.log(`[handleEvent] 检查分支1：标记渠道群 isSelf:${meId === senderTelegramID}`);
  if (
    meId === senderTelegramID &&
    typeof message.message === "string" &&
    message.message.startsWith("此群渠道群ID设为") &&
    message.message.includes("监听")
  ) {
    console.log(`[handleEvent] → 进入分支1：标记渠道群`);
    await handleMarkChannelGroup(client, chatId, chatTitle, message.message);
    return;
  }

  // ----------- 2. 标记商户群 -----------
  console.log(`[handleEvent] 检查分支2：标记商户群`);
  if (
    meId === senderTelegramID &&
    typeof message.message === "string" &&
    message.message.startsWith("此群标记为商户群") &&
    message.message.includes("监听")
  ) {
    console.log(`[handleEvent] → 进入分支2：标记商户群`);
    await handleMarkMerchantGroup(client, chatId, chatTitle, message.message);
    return;
  }

  // ----------- 3. 来源群监听，转发带订单图片 -----------
  const hasPhoto = message.media?.className === "MessageMediaPhoto";
  const hasText = typeof message.message === "string" && message.message.trim().length > 0;
  const hasOrderNo = orderRegex.test(message.message || "");
  console.log(`[handleEvent] 分支判断 chatId:${chatId} hasPhoto:${hasPhoto} hasText:${hasText} hasOrderNo:${hasOrderNo} hasReply:${!!message.replyTo}`);

  if (hasPhoto && hasText && hasOrderNo) {
    console.log(`[handleEvent] → 进入分支3：图片订单转发`);
    await handleMerchantOrderMessage(client, chatId, message);
    return;
  }

  // ----------- 4. 渠道群回复监听，转发回商户群 -----------
  if (message.replyTo && message.replyTo.replyToMsgId) {
    console.log(`[handleEvent] → 进入分支4：渠道群回复转发 replyToMsgId:${message.replyTo.replyToMsgId}`);
    await getOrRunMessageResponse(redis, chatId, message.id, 60, async () => {
      await handleChannelReply(client, chatId, chatTitle, message);
    });
    return;
  }

  console.log(`[handleEvent] ⚠️ 消息未匹配任何转发分支，已忽略 chatId:${chatId} msgId:${message.id}`);
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

  console.log(`[handleMerchantOrderMessage] chatId:${chatId} accountIdFromClient:${accountIdFromClient}`);
  console.log(`[handleMerchantOrderMessage] sourceGroupIds:`, [...sourceGroupIds]);
  console.log(`[handleMerchantOrderMessage] relevantAccountIds:`, [...relevantAccountIds]);

  if (!setHasChatId(sourceGroupIds, chatId)) {
    console.warn(`[handleMerchantOrderMessage] ❌ 跳过：chatId(${chatId}) 不在商户群列表中`);
    return;
  }
  if (!relevantAccountIds.has(accountIdFromClient)) {
    console.warn(`[handleMerchantOrderMessage] ❌ 跳过：当前账号(${accountIdFromClient}) 不在该商户群的负责账号列表中`);
    return;
  }

  const srcKey = `srcfwd:${chatId}:${message.id}`;
  const isFirstForSource = await onceByKey(redis, srcKey, 0);
  if (!isFirstForSource) {
    // 这条来源消息以前转发过了，直接跳过（哪怕过去一个月）
    return;
  }

  const orderId = message.message.match(orderRegex)?.[0];
  console.log(`[INFO] 检测到订单号: ${orderId}，开始查单...`);

  // —— 查单：order-in/get 获取订单详情（含 UTR/金额/创建时间/状态）——
  const detail = await orderQuery.queryOrderDetail(orderId);
  if (!detail) {
    console.warn(`[handleMerchantOrderMessage] 查单失败(接口无数据)，订单:${orderId}，仅记录日志，不通知商户`);
    return;
  }

  // 成功短路：已收款成功 → 直接回“查单成功”卡片，不转发渠道
  if (orderQuery.isSuccess(detail.status)) {
    const card = orderQuery.buildResultCard({ detail, submittedOrderNo: orderId, success: true, note: "已补单成功" });
    await client.sendMessage(chatId, { message: card, replyTo: message.id });
    console.log(`[INFO] 订单 ${orderId} 已成功(status=${detail.status})，直接回复商户，不转发渠道`);
    return;
  }

  // 非成功（含未支付/待收款/失败/取消）：一律先回“处理中”卡片，再把 平台单号+图片 转发渠道核实
  // 注意：不再凭平台接口状态自动判“查单失败”，失败与否由渠道（真实收款方）回复决定，避免漏单
  const queryingCard = orderQuery.buildQueryingCard(detail, orderId);
  await client.sendMessage(chatId, { message: queryingCard, replyTo: message.id });

  try {
    const channelId = detail.channelId;
    const orderNo = detail.orderNo || orderId;
    const targetChatIds = await tgDbService.getChatIdsByChannelIdInChannel(String(channelId));

    if (!targetChatIds.length) {
      await client.sendMessage(orderChatId, { message: `[WARN] 未找到 channelId=${channelId} 对应的群` });
      const errorSentMsg = await client.sendFile(orderChatId, { file: message.media, caption: `${orderNo}` });
      await addOrUpdateQueryTicket(errorSentMsg.id, message.id, chatId, channelId, orderId, orderChatId, detail);
      return;
    }
    for (const targetChatId of targetChatIds) {
      try {
        const sentMsg = await client.sendFile(targetChatId, { file: message.media, caption: `${orderNo}` });
        await addOrUpdateQueryTicket(sentMsg.id, message.id, chatId, channelId, orderId, targetChatId, detail);
        console.log(`Sent to ${targetChatId}:`, sentMsg.id);
      } catch (err) {
        console.error(`Failed to send to ${targetChatId}:`, err.message);
      }
    }
    console.log(`[INFO] 平台单号已转发至渠道群`);
  } catch (err) {
    console.error(`[ERROR] 转发渠道失败:`, err.message);
  }
}

// ========== 渠道群回复监听 → 回转商户群 ============
async function handleChannelReply(client, chatId, chatTitle, message) {
  try {
    const channelGroupIds = await tgDbService.getAllChatIdsInChannel();
    console.log(`[handleChannelReply] 渠道群列表:`, [...channelGroupIds]);
    if (!setHasChatId(channelGroupIds, chatId)) {
      console.warn(`[handleChannelReply] ❌ 跳过：chatId(${chatId}) 不在渠道群列表中，消息未转发`);
      return;
    }

    const replyToId = message.replyTo?.replyToMsgId;
    console.log(`[handleChannelReply] ✅ 命中渠道群 收到回复消息 msgId:${message.id}, 群:${chatTitle}(${chatId})`);
    if (!replyToId) {
      console.warn(`[handleChannelReply] ❌ 跳过：replyToId 为空`);
      return;
    }
    console.log(`[handleChannelReply] replyToId:${replyToId}`);

    const replyKey = `replyfwd:${chatId}:${message.id}`;
    const ok = await onceByKey(redis, replyKey, 60 * 60 * 24 * 30);
    if (!ok) {
      console.warn(`[handleChannelReply] ❌ 跳过：Redis去重，该消息已处理过 key:${replyKey}`);
      return;
    }

    //做一个"时效窗口"防止离线历史消息回放
    const now = Date.now();
    const msgTs = getMsgTimestampMillis(message);
    const ageSec = Math.floor((now - msgTs) / 1000);
    if (now - msgTs > MAX_THREAD_AGE_MS) {
      console.warn(`[handleChannelReply] ❌ 跳过：消息超时，消息时间戳:${msgTs} 当前:${now} 超过7天(${ageSec}秒前)`);
      return;
    }
    console.log(`[handleChannelReply] 消息时效检查通过，${ageSec}秒前发送`);

    const context = await tgDbService.getOrderByChannelMsgId(replyToId, chatId);
    //const context = orderContextMap.get(replyToId);
    console.log(`[DEBUG] 查询上下文 replyToId:${replyToId}, context:${JSON.stringify(context)}`);

    if (context && context.merchant_msg_id && context.merchant_chat_id) {
      // 工单已结单(1已完成/2待人工) → 不重复处理，避免给商户重复发卡片
      if (context.ticket_status != null && Number(context.ticket_status) !== 0) {
        console.log(`[INFO] 工单 ${context.id} 已结单(ticket_status=${context.ticket_status})，忽略本次渠道回复`);
        return;
      }
      const replyContent = (message.message || "").trim();
      if (!replyContent) return;
      const replyText = await tgDbService.getReplyText(replyContent);

      // 语料库匹配规则同旧逻辑：渠道回复"包含"配置的关键词(match_rule)才算命中；没命中就不回复
      if (replyText === null) {
        await client.sendMessage(orderChatId, {
          message: `语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`
        });
        console.log(`语料库不存在 ${replyContent}, 群 ID :${chatId}, 群名称 :${chatTitle}`);
        return;
      }
      const note = replyText.reply_text;
      const replyId = replyText.id;

      const isSuccessNote = /成功/.test(note) && !/失败/.test(note);

      // Q2：渠道回复「非成功」话术 → 不转发、不改状态，交给每小时平台重查决定
      if (!isSuccessNote) {
        console.log(`[INFO] 工单 ${context.id} 渠道回复为非成功话术("${note}")，按规则忽略，等平台重查`);
        return;
      }

      // 命中「成功」语料是子串匹配（"不成功" 也会命中 "成功" 规则）→ 必须再查一次平台二次确认，防误报成功
      const submittedOrderNo = context.merchant_order_id;
      const queryNo = context.platform_order_no || submittedOrderNo;
      const detail = await orderQuery.queryOrderDetail(queryNo);

      if (detail && orderQuery.isSuccess(detail.status)) {
        // ✅ 渠道 + 平台 双确认成功 → 回商户（文案用语料），结单
        if (await merchantMsgExists(client, context.merchant_chat_id, context.merchant_msg_id)) {
          const card = orderQuery.buildResultCard({ detail, submittedOrderNo, success: true, note });
          await client.sendMessage(BigInt(context.merchant_chat_id), {
            message: card, replyTo: Number(context.merchant_msg_id)
          });
        } else {
          console.log(`[INFO] 工单 ${context.id} 平台已确认成功，但商户原始消息已删，跳过通知，仅结单`);
        }
        await tgDbService.finishTicket(context.id, {
          queryResult: "查单成功", statusCode: detail.status, utr: detail.utr, matchedOrderNo: detail.merchantOrderNo
        });
        await tgDbService.updateOrderStatusByChannelMsgId(replyToId, chatId, replyId);
        console.log(`[INFO] 工单 ${context.id} 渠道+平台双确认成功，已回复商户并结单`);
      } else {
        // ⚠️ 渠道说成功但平台不认（失败/未处理）
        const st = detail ? detail.status : context.status_code;
        if (isOver48hByCreated(context.order_created_time)) {
          await sendConflictAlert(client, context, detail);        // ≥48h → 报警监听群
          await tgDbService.escalateTicket(context.id);            //        + 转人工
          console.log(`[INFO] 工单 ${context.id} 渠道说成功但平台(status=${st})不认且≥48h，已报警监听群并转人工`);
        } else {
          await tgDbService.markChannelClaimedSuccess(context.id); // <48h → 标记矛盾，等平台重查
          console.log(`[INFO] 工单 ${context.id} 渠道说成功但平台(status=${st})暂不认(<48h)，已标记待平台确认`);
        }
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

async function addOrUpdateOrder(channelMessageId, merchantMessageId, chatId, channelId, merchantOrderId, targetChatId) {
  try {
    await tgDbService.insertOrderContext(channelMessageId, merchantMessageId, chatId, channelId, merchantOrderId, targetChatId);
    console.log(`[INFO] 插入订单成功，商户ID: ${chatId}，订单: ${merchantOrderId}，channel_msg_id: ${channelMessageId}`);
  } catch (err) {
    console.error(" 插入 tg_order 失敗:", err.message);
  }
}

// ============ UTR 查单：建工单 / 时间判断 / 定时重查 ============

// 建一条"处理中"查单工单（转发渠道后调用）
async function addOrUpdateQueryTicket(channelMsgId, merchantMsgId, merchantChatId, channelId, submittedOrderNo, targetChatId, detail) {
  try {
    await tgDbService.insertQueryTicket({
      channelMsgId,
      merchantMsgId,
      merchantChatId,
      channelGroupId: channelId,
      merchantOrderId: submittedOrderNo,
      targetChatId,
      platformOrderNo: detail.orderNo,
      amount: detail.amount,
      orderCreatedTime: orderQuery.fmtTime(detail.createTime),
      statusCode: detail.status
    });
    console.log(`[INFO] 查单工单已建，商户群:${merchantChatId} 订单:${submittedOrderNo} channelMsg:${channelMsgId}`);
  } catch (err) {
    console.error("插入查单工单失败:", err.message);
  }
}

// ============ UTR 查单：辅助函数 + 每小时定时重查 ============

// 订单创建时间距今是否 ≥48 小时（兼容 Date 对象 / 数字时间戳 / 日期字符串）
function isOver48hByCreated(orderCreatedTime) {
  if (!orderCreatedTime) return false;
  let ms;
  if (orderCreatedTime instanceof Date) ms = orderCreatedTime.getTime();
  else ms = orderQuery.toEpochMs(orderCreatedTime);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms >= 48 * 60 * 60 * 1000;
}

// 查单失败/矛盾时的“状态说明”：优先平台 statusDesc，取不到写兜底
function failNote(detail) {
  return detail && detail.statusDesc ? String(detail.statusDesc) : "订单异常，请人工处理";
}

// 探测商户那条「原始订单消息」是否还在（被删则不发孤儿消息）；查询失败按存在处理
async function merchantMsgExists(client, merchantChatId, merchantMsgId) {
  try {
    const msgs = await client.getMessages(BigInt(merchantChatId), { ids: [Number(merchantMsgId)] });
    const m = msgs && msgs[0];
    return !!m && m.className !== "MessageEmpty";
  } catch (e) {
    console.warn(`[WARN] 检查原始消息是否存在失败，按存在处理: ${e.message}`);
    return true;
  }
}

// 找到能给该商户群发消息的 client（按商户群绑定账号定位，兜底取第一个）
async function findClientForMerchant(merchantChatId) {
  try {
    const accIds = await tgDbService.getAccountIdsByChatIdInMerchant(merchantChatId);
    for (const entry of clients) {
      if (accIds.has(entry.id) || accIds.has(String(entry.id)) || accIds.has(Number(entry.id))) {
        return entry.client;
      }
    }
  } catch (e) {
    console.error("findClientForMerchant:", e.message);
  }
  return clients[0] ? clients[0].client : null;
}

// 发「查单矛盾」到 Tg监听功能群（orderChatId），转人工
async function sendConflictAlert(client, ctx, detail) {
  const st = failNote(detail);
  const platformNo = ctx.platform_order_no || (detail && detail.orderNo) || "";
  const msg = `⚠️查单矛盾（请人工处理）｜订单:${ctx.merchant_order_id}｜平台单号:${platformNo}｜渠道判成功但平台判${st},已超48h,请人工核实｜商户群:${ctx.merchant_chat_id}`;
  try {
    await (client || (clients[0] && clients[0].client)).sendMessage(orderChatId, { message: msg });
  } catch (e) {
    console.error("sendConflictAlert 发送失败:", e.message);
  }
}

// 每小时定时重查：只扫真正在途的 UTR 工单（query_result='处理中'），逐条查平台
async function processOpenTickets() {
  let tickets;
  try {
    tickets = await tgDbService.getOpenUtrTickets();
  } catch (e) {
    console.error("[hourly] 取在途工单失败:", e.message);
    return;
  }
  if (!tickets || !tickets.length) return;
  console.log(`[hourly] 在途 UTR 工单 ${tickets.length} 条，开始平台重查`);

  for (const t of tickets) {
    try {
      const submittedOrderNo = t.merchant_order_id;
      const queryNo = t.platform_order_no || submittedOrderNo;
      const detail = await orderQuery.queryOrderDetail(queryNo);
      const client = await findClientForMerchant(t.merchant_chat_id);
      if (!client) { console.warn(`[hourly] 工单 ${t.id} 无可用 client，跳过`); continue; }

      if (detail && orderQuery.isSuccess(detail.status)) {
        // 平台成功 → 回商户「查单成功」，结单
        if (await merchantMsgExists(client, t.merchant_chat_id, t.merchant_msg_id)) {
          const card = orderQuery.buildResultCard({ detail, submittedOrderNo, success: true, note: "已补单成功" });
          await client.sendMessage(BigInt(t.merchant_chat_id), { message: card, replyTo: Number(t.merchant_msg_id) });
        }
        await tgDbService.finishTicket(t.id, {
          queryResult: "查单成功", statusCode: detail.status, utr: detail.utr, matchedOrderNo: detail.merchantOrderNo
        });
        console.log(`[hourly] 工单 ${t.id} 平台已成功，回复商户并结单`);
      } else if (isOver48hByCreated(t.order_created_time)) {
        if (Number(t.channel_claimed_success) === 1) {
          // 矛盾单 ≥48h → 报警监听群 + 转人工
          await sendConflictAlert(client, t, detail);
          await tgDbService.escalateTicket(t.id);
          console.log(`[hourly] 工单 ${t.id} 矛盾单≥48h，已报警监听群并转人工`);
        } else {
          // 普通死单 ≥48h → 回商户「查单失败」，结单
          if (await merchantMsgExists(client, t.merchant_chat_id, t.merchant_msg_id)) {
            const detailForCard = detail || {
              orderNo: t.platform_order_no, merchantOrderNo: submittedOrderNo,
              createTime: t.order_created_time, status: null
            };
            const card = orderQuery.buildResultCard({ detail: detailForCard, submittedOrderNo, success: false, note: failNote(detail) });
            await client.sendMessage(BigInt(t.merchant_chat_id), { message: card, replyTo: Number(t.merchant_msg_id) });
          }
          await tgDbService.finishTicket(t.id, {
            queryResult: "查单失败", statusCode: detail ? detail.status : null,
            utr: detail ? detail.utr : null, matchedOrderNo: detail ? detail.merchantOrderNo : null
          });
          console.log(`[hourly] 工单 ${t.id} 超48h仍未成功，回复商户查单失败并结单`);
        }
      }
      // 未满 48h 且未成功 → 什么都不做，等下小时再查
    } catch (err) {
      console.error(`[hourly] 处理工单 ${t.id} 失败:`, err.message);
    }
  }
}

const HOURLY_SCAN_MS = 60 * 60 * 1000; // 每小时扫一次在途工单
setInterval(() => {
  processOpenTickets().catch(console.error);
}, HOURLY_SCAN_MS);

// /矛盾：列出所有「待人工核实」的矛盾单
async function handleConflictList(client, chatId, message) {
  const rows = await tgDbService.getConflictTickets();
  if (!rows || rows.length === 0) {
    await client.sendMessage(chatId, { message: "当前没有待人工核实的矛盾单", replyTo: message.id });
    return;
  }
  let text = `⚠️ 待人工核实矛盾单 ${rows.length} 条（渠道判成功、平台判不成功、已超48h）：\n\n`;
  rows.forEach((r, i) => {
    text += `${i + 1}. 订单:${r.merchant_order_id}｜平台:${r.platform_order_no || "-"}｜商户群:${r.merchant_chat_id}\n`;
  });
  text += `\n人工核实处理后用「/矛盾处理:订单号」清除状态（商户号/平台号都可）`;
  await client.sendMessage(chatId, { message: text, replyTo: message.id });
}

// /矛盾处理:订单号 —— 人工核实处理后，仅在后台清除状态（ticket_status 2→1），不通知商户
// 订单号：商户单号 / 平台单号 都能匹配
async function handleConflictResolve(client, chatId, message) {
  const parts = message.message.replace(/：/g, ":").split(":");
  const orderNo = parts.slice(1).join(":").trim();
  if (!orderNo) {
    await client.sendMessage(chatId, { message: "❌ 格式错误，请使用 /矛盾处理:订单号", replyTo: message.id });
    return;
  }
  const affected = await tgDbService.resolveConflictByOrderNo(orderNo);
  await client.sendMessage(chatId, {
    message: affected > 0
      ? `✅ 矛盾单 ${orderNo} 已清除状态（${affected} 条）`
      : `⚠️ 未找到待处理的矛盾单 ${orderNo}（可能已处理或订单号有误，商户号/平台号均可）`,
    replyTo: message.id
  });
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

/**
 * 兼容 Telegram 两种 chatId 格式：
 *   GramJS MTProto: -1003551257408
 *   Bot API / 旧存储: -3551257408
 * 返回该 id 的所有可能格式，用于 Set.has() 双重匹配
 */
function chatIdVariants(id) {
  const s = String(id);
  if (s.startsWith('-100')) {
    return [s, '-' + s.slice(4)];   // [-1003551257408, -3551257408]
  } else if (s.startsWith('-')) {
    return [s, '-100' + s.slice(1)]; // [-3551257408, -1003551257408]
  }
  return [s];
}

function setHasChatId(set, chatId) {
  return chatIdVariants(chatId).some(v => set.has(v));
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
