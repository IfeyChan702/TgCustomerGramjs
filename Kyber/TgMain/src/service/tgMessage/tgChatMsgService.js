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
exports.getByTelegramIdChatId = async (telegramId, chatId) => {

  const sql = `SELECT *
               FROM tg_account_chat
               WHERE telegram_id = ?
                 AND chat_id = ? LIMIT 1`;

  const [rows] = await db.query(sql, [telegramId, chatId]);

  return rows[0] || null;
};

/**
 * 插入tgChatMessage关系表数据
 * @param telegramId
 * @param chatId
 * @return {Promise<unknown>}
 */
exports.insert = async (telegramId, chatId) => {

  const sql = `INSERT INTO tg_account_chat(telegram_id, chat_id, is_receive_msg)
               VALUES (?, ?, 1)`;

  return await db.query(sql, [telegramId, chatId]);
};

exports.upsertMessage = async (row) => {
  const sql = `
      INSERT INTO tg_message
      (chat_id, message_id, sender_id, sender_username, sender_first_name, sender_last_name,
       text, date, raw_json, reply_to_message_id, is_bot_reply, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?, ?, ?, ?) ON DUPLICATE KEY
      UPDATE
          sender_username =
      VALUES (sender_username), sender_first_name =
      VALUES (sender_first_name), sender_last_name =
      VALUES (sender_last_name), text =
      VALUES (text), date =
      VALUES (date), raw_json =
      VALUES (raw_json), reply_to_message_id =
      VALUES (reply_to_message_id), is_bot_reply =
      VALUES (is_bot_reply)
  `;

  const params = [
    row.chat_id,
    row.message_id,
    row.sender_id,
    row.sender_username,
    row.sender_first_name,
    row.sender_last_name,
    row.text,
    Math.floor(row.date / 1000),
    row.raw_json,
    row.reply_to_message_id,
    row.is_bot_reply ?? 0,
    row.is_read ?? 0
  ];

  return db.query(sql, params);
};

