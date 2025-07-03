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
                     WHERE is_running = 1
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
const insertOrderContext = async (channelMsgId, merchantMsgId, merchantChatId, channelGroupId, merchantOrderId) => {

  const sql = `
      INSERT INTO tg_order (channel_msg_id,
                            merchant_msg_id,
                            merchant_chat_id,
                            channel_group_id,
                            status,
                            created_time,
                            merchant_order_id)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `;

  const values = [
    channelMsgId,
    merchantMsgId,
    merchantChatId,
    channelGroupId,
    0, // status 設為 0
    merchantOrderId
  ];

  const result = await queryAsync(sql, values);
  return result.insertId;
};
/**
 * 根据channelMsgId查询tg_order表的订单
 */
const getOrderByChannelMsgId = async (channelMsgId) => {
  const sql = `SELECT t.*
               FROM tg_order t
               WHERE channel_msg_id = ?`;
  const results = await queryAsync(sql, [channelMsgId]);
  return results.length > 0 ? results[0] : null;
};
/**
 * 根据channelMsgId修改条件的状态和replyId（replyId有可能为空）
 * @param originalMsgId
 * @param newStatus
 * @returns {Promise<*>}
 */
const updateOrderStatusByChannelMsgId = async (channelMsgId, replyId) => {
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

  sql += ` WHERE channel_msg_id = ?`;
  values.push(channelMsgId);

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
const getOrderByMeChMoCo = async (merchantChatId, channelGroupId, merchantOrderId) => {
  const sql = `SELECT COUNT(*) AS count
               FROM tg_order
               WHERE merchant_chat_id = ?
                 AND channel_group_id = ?
                 AND merchant_order_id = ?`;
  const values = [
    merchantChatId,
    channelGroupId,
    merchantOrderId
  ];
  const results = await queryAsync(sql, values);
  return results[0].count > 0;
};
/**
 * 根据merchantId,channelId,merchantOrderId,channelOrderId这四个字段，修改channel_msg_id，merchant_msg_id这两个字段
 */
const updateMsgIdsByOrderKey = async (newChannelMsgId, newMerchantMsgId, merchantChatId, channelGroupId, merchantOrderId) => {
  const sql = `
      UPDATE tg_order
      SET channel_msg_id  = ?,
          merchant_msg_id = ?
      WHERE merchant_chat_id = ?
        AND channel_group_id = ?
        AND merchant_order_id = ?
  `;
  const values = [
    newChannelMsgId,
    newMerchantMsgId,
    merchantChatId,
    channelGroupId,
    merchantOrderId
  ];

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
 * @returns {Promise<void>}
 */
const checkAndProcessOrder = async (merchantOrderId) => {

  const selectSql = `SELECT id, status
                     FROM tg_order
                     WHERE merchant_order_id = ? LIMIT 1`;
  const orders = await queryAsync(selectSql, [merchantOrderId]);

  if (!orders || orders.length === 0) {
    return { found: false };
  }

  const order = orders[0];
  if (order.status !== 0) {
    return { found: true, alreadyProcessed: true };
  }

  // 2. 更新状态
  const updateSql = `UPDATE tg_order
                     SET status = 1
                     WHERE id = ?`;
  const result = await queryAsync(updateSql, [order.id]);

  if (result.affectedRows > 0) {
    return { found: true, updated: true };
  } else {
    return { found: true, updated: false };
  }
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
    const result = await db.query(sql, [isRunning, accId]);
    if (result.affectedRows === 0) {
      console.log(`[WARNING] No account found with Id = ${accId}`);
    }
    return result;
  } catch (err) {
    console.error("Failed to update is_running:", err);
    throw err;
  }
};



// 统一导出
module.exports = {
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
  updateRunningByAccId
};
