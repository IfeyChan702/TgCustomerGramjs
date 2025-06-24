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
  const results = await queryAsync(`SELECT * FROM tg_accounts WHERE registerId IN (?)`, [registerIds]);
  return results;
};

/**
 * 插入/更新群组-频道信息
 */
const insertGroupChannel = async (tg_account_id, group_id, chat_id, group_name, role, template_id) => {
  const sql = `
    INSERT INTO tg_groups_channel 
    (tg_account_id, group_id, chat_id, group_name, role, template_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE group_id=VALUES(group_id), group_name=VALUES(group_name), 
    role=VALUES(role), template_id=VALUES(template_id), created_at=CURRENT_TIMESTAMP
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
    if (err.code === 'ER_DUP_ENTRY') return 0;
    throw err;
  }
};

/**
 * 根据 accountId Set 查找 tg_groups_merchant 表中 chat_id Set
 */
const getChatIdsByAccountInMerchant = async (registerIdSet) => {
  if (!registerIdSet || !registerIdSet.size) return new Set();
  const ids = Array.from(registerIdSet);
  const sql = `SELECT chat_id FROM tg_groups_merchant WHERE tg_account_id IN (${ids.map(() => '?').join(',')})`;
  const results = await queryAsync(sql, ids);
  return new Set(results.map(row => row.chat_id));
};


/**
 * 查找 tg_groups_merchant 表中 chat_id Set
 * @returns {Promise<Set<any>>}
 */
const getAllChatIdsInMerchant = async () => {
  const sql = `SELECT chat_id FROM tg_groups_merchant`;
  const results = await queryAsync(sql);
  return new Set(results.map(row => row.chat_id));
};

/**
 * 查找 tg_groups_merchant 表中 的 tg_account_id
 * @returns {Promise<Set<any>>}
 */
const getAllAccountIdsInMerchant = async () => {
  const sql = `SELECT tg_account_id FROM tg_groups_merchant`;
  const results = await queryAsync(sql);
  return new Set(results.map(row => row.tg_account_id));
};

/**
 * 從Chat_id 查找 tg_groups_merchant 表中 的 tg_account_id
 * @param chatId
 * @returns {Promise<Set<any>>}
 */
const getAccountIdsByChatIdInMerchant = async (chatId) => {
  const sql = `SELECT tg_account_id FROM tg_groups_merchant WHERE chat_id = ?`;
  const results = await queryAsync(sql, [chatId]);
  return new Set(results.map(row => row.tg_account_id));
};


/**
 * 根据 accountId Set 查找 tg_groups_channel 表中 chat_id Set
 */
const getChatIdsByAccountInChannel = async (registerIdSet) => {
  if (!registerIdSet || !registerIdSet.size) return new Set();
  const ids = Array.from(registerIdSet);
  const sql = `SELECT chat_id FROM tg_groups_channel WHERE tg_account_id IN (${ids.map(() => '?').join(',')})`;
  const results = await queryAsync(sql, ids);
  return new Set(results.map(row => row.chat_id));
};

/**
 * 查找 tg_groups_channel 表中 chat_id Set
 * @returns {Promise<Set<any>>}
 */
const getAllChatIdsInChannel = async () => {
  const sql = `SELECT chat_id FROM tg_groups_channel`;
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
    JOIN (
      SELECT phone, MAX(created_at) AS latest_created_at
      FROM tg_accounts
      WHERE is_running = 1
      GROUP BY phone
    ) t2 ON t1.phone = t2.phone AND t1.created_at = t2.latest_created_at
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
    JOIN (
      SELECT phone, MAX(created_at) AS latest_created_at
      FROM tg_accounts
      WHERE is_running = 1
      GROUP BY phone
    ) t2 ON t1.phone = t2.phone AND t1.created_at = t2.latest_created_at
  `;
  return await queryAsync(sql);
};

/**
 * 查找回复文本（根据匹配规则）
 */
const getReplyText = async (matchRule) => {
  const sql = `SELECT reply_text FROM tg_reply WHERE match_rule = ? LIMIT 1`;
  const results = await queryAsync(sql, [matchRule]);
  return results.length > 0 ? results[0].reply_text : null;
};

/**
 * 根据 id 查找账户信息
 */
const getAccountById = async (id) => {
  const sql = `SELECT * FROM tg_accounts WHERE id = ?`;
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
  const sql = `SELECT id FROM tg_accounts WHERE telegram_id = ?`;
  const results = await queryAsync(sql, [telegramId]);
  return results.length > 0 ? results[0].id : null;
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
  getChatIdsByAccountInMerchant,
  getChatIdsByAccountInChannel,
  getChatIdsByChannelIdInChannel,
  getLatestRegisterIds,
  getLatestAccountIds,
  getReplyText,
  getAccountById,
};
