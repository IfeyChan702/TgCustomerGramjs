const connection = require("../models/mysqlModel");

/**
 * 工具函数：Promise风格的MySQL查询
 */
function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

/**
 * 获取第二条 registerId
 */
const getTopRegisterId = async () => {
  const results = await queryAsync("SELECT registerId FROM tg_accounts LIMIT 1 OFFSET 1");
  return results[0]?.registerId;
};

/**
 * 根据 registerId 数组获取账号信息
 */
const getAccountByRegisterIdArray = async (registerIds) => {
  if (!Array.isArray(registerIds) || !registerIds.length) throw new Error("registerIds must be a non-empty array");
  const results = await queryAsync(`SELECT *
                                    FROM tg_accounts
                                    WHERE registerId IN (?)`, [registerIds]);
  return results;
};

/**
 * 插入/更新群组-频道信息
 */
const insertGroupChannel = async (tg_account_id, group_id, chat_id, group_name, role, template_id) => {
  const sql = `
      INSERT INTO tg_groups_channel
      (tg_account_id, group_id, chat_id, group_name, role, template_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY
      UPDATE group_id=
      VALUES (group_id), group_name=
      VALUES (group_name), role =
      VALUES (role), template_id=
      VALUES (template_id), created_at= CURRENT_TIMESTAMP
  `;
  const values = [tg_account_id, group_id, chat_id, group_name, role, template_id];
  const result = await queryAsync(sql, values);
  // MySQL affectedRows=2 表示更新，=1为插入
  return result.affectedRows > 1 ? 0 : result.insertId;
};

/**
 * 插入商户群信息（唯一性冲突返回0）
 */
const insertGroupMerchant = async (tg_account_id, chat_id, group_name, role, template_id) => {
  try {
    const sql = `
        INSERT INTO tg_groups_merchant
            (tg_account_id, chat_id, group_name, role, template_id, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const values = [tg_account_id, chat_id, group_name, role, template_id];
    const result = await queryAsync(sql, values);
    return result.insertId;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return 0;
    throw err;
  }
};

/**
 * 根据 accountId Set 查找 tg_groups_merchant 表中 chat_id Set
 */
const getChatIdsByAccountInMerchant = async (registerIdSet) => {
  if (!registerIdSet || !registerIdSet.size) return new Set();
  const ids = Array.from(registerIdSet);
  const sql = `SELECT chat_id
               FROM tg_groups_merchant
               WHERE tg_account_id IN (${ids.map(() => "?").join(",")})`;
  const results = await queryAsync(sql, ids);
  return new Set(results.map(row => row.chat_id));
};


/**
 * 查找 tg_groups_merchant 表中 chat_id Set
 * @returns {Promise<Set<any>>}
 */
const getAllChatIdsInMerchant = async () => {
  const sql = `SELECT chat_id
               FROM tg_groups_merchant`;
  const results = await queryAsync(sql);
  return new Set(results.map(row => row.chat_id));
};

/**
 * 查找 tg_groups_merchant 表中 的 tg_account_id
 * @returns {Promise<Set<any>>}
 */
const getAllAccountIdsInMerchant = async () => {
  const sql = `SELECT tg_account_id
               FROM tg_groups_merchant`;
  const results = await queryAsync(sql);
  return new Set(results.map(row => row.tg_account_id));
};

/**
 * 從Chat_id 查找 tg_groups_merchant 表中 的 tg_account_id
 * @param chatId
 * @returns {Promise<Set<any>>}
 */
const getAccountIdsByChatIdInMerchant = async (chatId) => {
  const sql = `SELECT tg_account_id
               FROM tg_groups_merchant
               WHERE chat_id = ?`;
  const results = await queryAsync(sql, [chatId]);
  return new Set(results.map(row => row.tg_account_id));
};


/**
 * 根据 accountId Set 查找 tg_groups_channel 表中 chat_id Set
 */
const getChatIdsByAccountInChannel = async (registerIdSet) => {
  if (!registerIdSet || !registerIdSet.size) return new Set();
  const ids = Array.from(registerIdSet);
  const sql = `SELECT chat_id
               FROM tg_groups_channel
               WHERE tg_account_id IN (${ids.map(() => "?").join(",")})`;
  const results = await queryAsync(sql, ids);
  return new Set(results.map(row => row.chat_id));
};

/**
 * 查找 tg_groups_channel 表中 chat_id Set
 * @returns {Promise<Set<any>>}
 */
const getAllChatIdsInChannel = async () => {
  const sql = `SELECT chat_id
               FROM tg_groups_channel`;
  const results = await queryAsync(sql);
  return new Set(results.map(row => row.chat_id));
};


/**
 * 查找 channelId 在 tg_groups_channel 表中的所有 chat_id（按创建时间倒序）
 */
const getChatIdsByChannelIdInChannel = async (channelId) => {
  const sql = "SELECT chat_id FROM tg_groups_channel WHERE group_id = ? ORDER BY created_at DESC";
  const results = await queryAsync(sql, [channelId]);
  return results.map(row => row.chat_id);
};

/**
 * 查找 is_running=1 且每个 phone 最新创建的 registerId
 */
const getLatestRegisterIds = async () => {
  const sql = `
      SELECT t1.registerId
      FROM tg_accounts t1
               JOIN (SELECT phone, MAX(created_at) AS latest_created_at
                     FROM tg_accounts
                     WHERE is_running != 0
                     GROUP BY phone) t2 ON t1.phone = t2.phone AND t1.created_at = t2.latest_created_at
  `;
  const results = await queryAsync(sql);
  return results.map(row => row.registerId);
};

/**
 * 查找 is_running=1 且每个 phone 最新创建的 id
 */
const getLatestAccountIds = async () => {
  const sql = `
      SELECT t1.id
      FROM tg_accounts t1
               JOIN (SELECT phone, MAX(created_at) AS latest_created_at
                     FROM tg_accounts
                     WHERE is_running = 1
                     GROUP BY phone) t2 ON t1.phone = t2.phone AND t1.created_at = t2.latest_created_at
  `;
  return await queryAsync(sql);
};

/**
 * 查找回复文本（根据匹配规则）
 */
const getReplyText = async (matchRule) => {
  const sql = `
      SELECT id, reply_text
      FROM tg_reply
      WHERE ? LIKE CONCAT('%', match_rule, '%') LIMIT 1
  `;
  const results = await queryAsync(sql, [matchRule]);
  return results.length > 0 ? results[0] : null;
};

/**
 * 根据 id 查找账户信息
 */
const getAccountById = async (id) => {
  const sql = `SELECT *
               FROM tg_accounts
               WHERE id = ?`;
  const results = await queryAsync(sql, [id]);
  return results.length > 0 ? results[0] : null;
};


/**
 * 拿包含Group_id和Chat_id的總數
 * @param groupId
 * @param chatId
 * @param accountId
 * @returns {Promise<number|number>}
 */
const getGroupAccountChannelCount = async (groupId, accountId) => {
  const sql = `
      SELECT COUNT(*) AS count
      FROM tg_groups_channel
      WHERE group_id = ? AND tg_account_id = ?
  `;
  const results = await queryAsync(sql, [groupId, accountId]);
  return results.length > 0 ? parseInt(results[0].count, 10) : 0;
};


/**
 * 拿包含Group_id的總數
 * @param groupId
 * @returns {Promise<number|number>}
 */
const getGroupIdChannelCount = async (groupId) => {
  const sql = `
      SELECT COUNT(*) AS count
      FROM tg_groups_channel
      WHERE group_id = ?
  `;
  const results = await queryAsync(sql, [groupId]);
  return results.length > 0 ? parseInt(results[0].count, 10) : 0;
};


/**
 * 查找有沒有用過Chat ID
 * @param chatId
 * @param excludedAccountId
 * @returns {Promise<number|number>}
 */
const getChannelChatIdCountExcludingAccount = async (chatId, excludedAccountId) => {
  const sql = `
      SELECT COUNT(*) AS count
      FROM tg_groups_channel
      WHERE chat_id = ? AND tg_account_id != ?
  `;
  const results = await queryAsync(sql, [chatId, excludedAccountId]);
  return results.length > 0 ? parseInt(results[0].count, 10) : 0;
};

/**
 * 查找有沒有用過Chat ID
 * @param chatId
 * @param excludedAccountId
 * @returns {Promise<number|number>}
 */
const getMerchantChatIdCountExcludingAccount = async (chatId, excludedAccountId) => {
  const sql = `
      SELECT COUNT(*) AS count
      FROM tg_groups_merchant
      WHERE chat_id = ? AND tg_account_id != ?
  `;
  const results = await queryAsync(sql, [chatId, excludedAccountId]);
  return results.length > 0 ? parseInt(results[0].count, 10) : 0;
};

/**
 * 從TelegramID找AccountID
 * @param telegramId
 * @returns {Promise<*|null>}
 */
const getAccountIdByTelegramId = async (telegramId) => {
  const sql = `SELECT id
               FROM tg_accounts
               WHERE telegram_id = ?`;
  const results = await queryAsync(sql, [telegramId]);
  return results.length > 0 ? results[0].id : null;
};

/**
 * 添加order数据
 */
const insertOrderContext = async (channelMsgId, merchantMsgId, merchantChatId, channelGroupId, merchantOrderId,targetChatId) => {

  const sql = `
      INSERT INTO tg_order (channel_msg_id,
                            merchant_msg_id,
                            merchant_chat_id,
                            channel_group_id,
                            status,
                            created_time,
                            merchant_order_id,
                            target_chat_id)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
  `;
  const values = [
    channelMsgId,
    merchantMsgId,
    merchantChatId,
    channelGroupId,
    0,
    merchantOrderId,
    targetChatId
  ];

  const result = await queryAsync(sql, values);
  return result.insertId;
};
/**
 * 根据channelMsgId查询tg_order表的订单
 */
const getOrderByChannelMsgId = async (channelMsgId, targetChatId) => {
  // 兼容 -100 前缀：GramJS 传入 -1003551257408，数据库可能存的是 -3551257408
  const s = String(targetChatId);
  const variants = s.startsWith('-100')
    ? [s, '-' + s.slice(4)]
    : [s, '-100' + s.slice(1)];

  const sql = `SELECT t.*
               FROM tg_order t
               WHERE channel_msg_id = ? AND target_chat_id IN (?, ?)`;
  const results = await queryAsync(sql, [channelMsgId, variants[0], variants[1]]);
  return results.length > 0 ? results[0] : null;
};
/**
 * 根据channelMsgId修改条件的状态和replyId（replyId有可能为空）
 * @param originalMsgId
 * @param newStatus
 * @returns {Promise<*>}
 */
const updateOrderStatusByChannelMsgId = async (channelMsgId, targetChatId, replyId) => {
  let sql = `
      UPDATE tg_order
      SET status = 1
  `;
  const values = [];

  // 仅当 replyId 不为 null/undefined 时更新 reply_id 字段
  if (replyId !== null && replyId !== undefined) {
    sql += `, tg_reply_id = ?`;
    values.push(replyId);
  }

  // 兼容 -100 前缀两种格式
  const s = String(targetChatId);
  const variants = s.startsWith('-100')
    ? [s, '-' + s.slice(4)]
    : [s, '-100' + s.slice(1)];
  sql += ` WHERE channel_msg_id = ? AND target_chat_id IN (?, ?)`;
  values.push(channelMsgId, variants[0], variants[1]);

  try {
    const result = await queryAsync(sql, values);
    console.log(`[INFO] 已将 channel_msg_id=${channelMsgId} 的订单更新为 status=1${replyId != null ? `, reply_id=${replyId}` : ""}，影响笔数: ${result.affectedRows}`);
    return result.affectedRows;
  } catch (err) {
    console.error(`[ERROR] 更新订单状态失败: ${err.message}`);
    throw err;
  }
};

/**
 * 根据 merchantId, channelId, merchantOrderId, channelOrderId
 */
const getOrderByMeChMoCo = async (merchantChatId, channelGroupId, merchantOrderId, targetChatId) => {
  const sql = `SELECT COUNT(*) AS count
               FROM tg_order
               WHERE merchant_chat_id = ?
                 AND channel_group_id = ?
                 AND merchant_order_id = ?
                 AND target_chat_id = ?`;
  const values = [
    merchantChatId,
    channelGroupId,
    merchantOrderId,
    targetChatId
  ];
  const results = await queryAsync(sql, values);
  return results[0].count > 0;
};
/**
 * 根据merchantId,channelId,merchantOrderId,channelOrderId这四个字段，修改channel_msg_id，merchant_msg_id这两个字段
 */
const updateMsgIdsByOrderKey = async (newChannelMsgId, newMerchantMsgId, merchantChatId, channelGroupId, merchantOrderId, targetChatId) => {
  const sql = `
      UPDATE tg_order
      SET channel_msg_id  = ?,
          merchant_msg_id = ?
      WHERE merchant_chat_id = ?
        AND channel_group_id = ?
        AND merchant_order_id = ?
        AND target_chat_id = ?
  `;
  const values = [newChannelMsgId, newMerchantMsgId, merchantChatId, channelGroupId, merchantOrderId, targetChatId];

  const result = await queryAsync(sql, values);
  return result.affectedRows;
};

/**
 * 查询“未处理”的订单
 * @returns {Promise<unknown>}
 */
const getPendingOrders = async () => {
  const sql = `SELECT *
               FROM tg_order
               WHERE status = 0
               ORDER BY id ASC LIMIT 20`;
  const results = await queryAsync(sql);
  return results;
};

/**
 * 检验用户状态，并修改用户状态
 * @param merchantOrderId
 * @returns {Promise<{found: boolean}>}
 */
const checkAndProcessOrder = async (merchantOrderId) => {

  const selectSql = `SELECT id, status FROM tg_order WHERE merchant_order_id = ?`;
  const orders = await queryAsync(selectSql, [merchantOrderId]);

  if (!orders || orders.length === 0) {
    return { found: false };
  }

  const total = orders.length;
  const pending = orders.filter(o => o.status === 0);
  const processed = orders.filter(o => o.status === 1);

  // 2. 全部已处理过
  if (pending.length === 0) {
    return {
      found: true,
      alreadyProcessed: true,
      total,
      processedCount: processed.length
    };
  }

  // 3. 批量更新所有未处理的记录
  const pendingIds = pending.map(o => o.id);
  const updateSql = `UPDATE tg_order SET status = 1 WHERE id IN (?) AND status = 0`;
  const result = await queryAsync(updateSql, [pendingIds]);

  return {
    found: true,
    updated: result.affectedRows > 0,
    total,
    updatedCount: result.affectedRows,
    alreadyProcessedCount: processed.length
  };
};
/**
 * 根据 status 查找账户信息
 */
const getAccountByIsRunning = async (isRunning) => {
  const sql = `SELECT id
               FROM tg_accounts
               WHERE is_running = ?`;
  return await queryAsync(sql, [isRunning]);
};

/**
 * 根据ID和status查找数据
 */
const isAccountExistsWithStatus = async (id, accStatus) => {
  const sql = `SELECT 1 FROM tg_accounts WHERE id = ? AND status = ? LIMIT 1`;
  const result = await queryAsync(sql, [id, accStatus]);
  return result.length > 0;
};

/**
 * 根据id修改isRunning
 * @param accId
 * @param isRunning
 * @returns {Promise<void>}
 */
const updateRunningByAccId = async (accId, isRunning) => {
  const sql = ` UPDATE tg_accounts
                SET is_running = ?
                WHERE Id = ?`;
  try {
    const result = await queryAsync(sql, [isRunning, accId]);
    if (result.affectedRows === 0) {
      console.log(`[WARNING] No account found with Id = ${accId}`);
    }
    return result;
  } catch (err) {
    console.error("Failed to update is_running:", err);
    throw err;
  }
};
/**
 * 根据identifier查询数据
 * @param identifier
 * @return {Promise<*>}
 */
const getCommandByIdentifier = async (identifier) => {
  const sql = `SELECT * FROM tg_command_list WHERE identifier = ? LIMIT 1`;
  try {
    const result = await queryAsync(sql, [identifier]);
    return result[0] || null;
  } catch (err) {
    console.error(`getCommandByIdentifier 报错：`, err);
    throw err;
  }
}
/**
 * 根据commandId查询参数
 * @param commandId
 * @return {Promise<unknown>}
 */
const getParamsByCommandId = async (commandId) => {
  const sql = `SELECT * FROM tg_parameter_list WHERE command_list_id = ? ORDER BY id ASC`;
  try {
    return await queryAsync(sql, [commandId]);
  } catch (err) {
    console.error(`getParamsByCommandId 报错：`, err);
    throw err;
  }
}
/**
 * 根据commandId，groupId查询权限状态
 * @param commandId
 * @param groupId
 * @return {Promise<boolean>}
 */
const isGroupAllowedForCommand = async (commandId,groupId) => {
  const sql = `SELECT 1 FROM tg_command_group_permission WHERE command_id = ? AND group_id = ? AND status = 1`;
  try {
    const result = await queryAsync(sql,[commandId,groupId]);
    return result.length > 0;
  }catch (err){
    console.error(`isGroupAllowedForCommand 报错：`, err);
    throw err
  }
}


/**
 * 插入一条"处理中"的查单工单（含 UTR 查单相关字段）
 * @param p { channelMsgId, merchantMsgId, merchantChatId, channelGroupId, merchantOrderId,
 *            targetChatId, platformOrderNo, amount, orderCreatedTime, statusCode }
 * @returns {Promise<number>} 新插入行 id
 */
const insertQueryTicket = async (p) => {
  const sql = `
      INSERT INTO tg_order (channel_msg_id,
                            merchant_msg_id,
                            merchant_chat_id,
                            channel_group_id,
                            status,
                            created_time,
                            merchant_order_id,
                            target_chat_id,
                            platform_order_no,
                            amount,
                            order_created_time,
                            status_code,
                            query_result,
                            ticket_status)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, '处理中', 0)
  `;
  const values = [
    p.channelMsgId,
    p.merchantMsgId,
    p.merchantChatId,
    p.channelGroupId,
    p.merchantOrderId,
    p.targetChatId,
    p.platformOrderNo || null,
    p.amount != null ? p.amount : null,
    p.orderCreatedTime || null,
    p.statusCode != null ? p.statusCode : null,
  ];
  const result = await queryAsync(sql, values);
  return result.insertId;
};

/**
 * 结束工单（查单成功/查单失败终态），同时同步 legacy status=1
 */
const finishTicket = async (id, { queryResult, statusCode, utr, matchedOrderNo }) => {
  const sql = `
      UPDATE tg_order
      SET status           = 1,
          ticket_status    = 1,
          next_retry_time  = NULL,
          query_result     = ?,
          status_code      = ?,
          utr              = ?,
          matched_order_no = ?
      WHERE id = ?
  `;
  const values = [queryResult, statusCode != null ? statusCode : null, utr || null, matchedOrderNo || null, id];
  const result = await queryAsync(sql, values);
  return result.affectedRows;
};

/**
 * 安排下一次自动重查（+1小时），并累加重查次数
 */
const scheduleNextRetry = async (id) => {
  const sql = `
      UPDATE tg_order
      SET next_retry_time = DATE_ADD(NOW(), INTERVAL 1 HOUR),
          retry_count     = retry_count + 1
      WHERE id = ?
  `;
  const result = await queryAsync(sql, [id]);
  return result.affectedRows;
};

/**
 * 取所有到期需要自动重查的处理中工单
 */
const getDueRetryTickets = async () => {
  const sql = `
      SELECT id,
             merchant_chat_id,
             merchant_msg_id,
             merchant_order_id,
             platform_order_no,
             order_created_time,
             retry_count
      FROM tg_order
      WHERE ticket_status = 0
        AND next_retry_time IS NOT NULL
        AND next_retry_time <= NOW()
      ORDER BY next_retry_time ASC
      LIMIT 50
  `;
  return await queryAsync(sql);
};

/**
 * 取所有「在途」UTR 查单工单（每小时定时重查用）
 * 注意：必须限定 query_result='处理中'，只取真正的 UTR 工单，
 * 否则会把 3 万多条 query_result=NULL 的旧历史行也扫进来。
 */
const getOpenUtrTickets = async () => {
  const sql = `
      SELECT id,
             merchant_chat_id,
             merchant_msg_id,
             merchant_order_id,
             platform_order_no,
             order_created_time,
             channel_claimed_success
      FROM tg_order
      WHERE ticket_status = 0
        AND query_result = '处理中'
      ORDER BY id ASC
      LIMIT 500
  `;
  return await queryAsync(sql);
};

/**
 * 标记「渠道声称成功、但平台暂未确认」（<48h 的矛盾单，等平台重查确认）
 */
const markChannelClaimedSuccess = async (id) => {
  const result = await queryAsync(
    `UPDATE tg_order SET channel_claimed_success = 1 WHERE id = ?`, [id]);
  return result.affectedRows;
};

/**
 * 升级为「待人工核实」（矛盾单 ≥48h）：ticket_status=2，已报警监听群
 */
const escalateTicket = async (id) => {
  const result = await queryAsync(
    `UPDATE tg_order SET ticket_status = 2, query_result = '待人工核实', next_retry_time = NULL WHERE id = ?`, [id]);
  return result.affectedRows;
};

/**
 * 取所有「待人工核实」的矛盾单（/矛盾 命令用）
 */
const getConflictTickets = async () => {
  const sql = `
      SELECT id, merchant_order_id, platform_order_no, merchant_chat_id,
             order_created_time, status_code, created_time
      FROM tg_order
      WHERE ticket_status = 2
      ORDER BY created_time ASC
      LIMIT 100
  `;
  return await queryAsync(sql);
};

/**
 * 人工把矛盾单清除状态（ticket_status 2 → 1，仅后台标记，不通知商户）
 * 订单号：商户单号 / 平台单号 都能匹配
 */
const resolveConflictByOrderNo = async (orderNo) => {
  const result = await queryAsync(
    `UPDATE tg_order SET ticket_status = 1, query_result = '已人工处理'
     WHERE (merchant_order_id = ? OR platform_order_no = ?) AND ticket_status = 2`,
    [orderNo, orderNo]);
  return result.affectedRows;
};

// 统一导出
module.exports = {
  insertQueryTicket,
  finishTicket,
  scheduleNextRetry,
  getDueRetryTickets,
  getOpenUtrTickets,
  markChannelClaimedSuccess,
  escalateTicket,
  getConflictTickets,
  resolveConflictByOrderNo,
  getAccountIdsByChatIdInMerchant,
  getAccountIdByTelegramId,
  getAllAccountIdsInMerchant,
  getAllChatIdsInChannel,
  getAllChatIdsInMerchant,
  getMerchantChatIdCountExcludingAccount,
  getChannelChatIdCountExcludingAccount,
  getGroupAccountChannelCount,
  getGroupIdChannelCount,
  getTopRegisterId,
  getAccountByRegisterIdArray,
  insertGroupChannel,
  insertGroupMerchant,
  insertOrderContext,
  getChatIdsByAccountInMerchant,
  getChatIdsByAccountInChannel,
  getChatIdsByChannelIdInChannel,
  getLatestRegisterIds,
  getLatestAccountIds,
  getReplyText,
  getAccountById,
  getOrderByChannelMsgId,
  updateOrderStatusByChannelMsgId,
  getOrderByMeChMoCo,
  updateMsgIdsByOrderKey,
  getPendingOrders,
  checkAndProcessOrder,
  getAccountByIsRunning,
  isAccountExistsWithStatus,
  updateRunningByAccId,
  getCommandByIdentifier,
  getParamsByCommandId,
  isGroupAllowedForCommand
};
