const util = require("util");
const db = require("../../models/mysqlModel");
const { rejects } = require("node:assert");
const { valueOf } = require("jest");

/**
 * 根据telegramId和chatId查询tgChatMessage的关系
 * @param telegramId
 * @param chatId
 * @return {Promise<*|null>}
 */
exports.getMessageById = async (telegramId, chatId) => {

  const sql = `SELECT *
               FROM tg_account_chat
               WHERE telegram_id = ?
                 AND chat_id = ? LIMIT 1`;


  const [rows] = await db.query(sql, [telegramId, chatId]);

  return rows[0] || null;
};
