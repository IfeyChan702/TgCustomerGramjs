const util = require("util");
const db = require("../../models/mysqlModel");
const { rejects } = require("node:assert");
const { valueOf } = require("jest");
const { getRawAsset } = require("node:sea");

/**
 * 根据chatId来查询用户的信息
 * @param chatId
 * @return {Promise<*|null>}
 */
exports.getByChatId = async (chatId) => {

  const sql = `SELECT *
               FROM tg_chat
               WHERE id = ? LIMIT 1`;

  const [row] = await db.query(sql, [chatId]);

  return row[0] || null;
};

exports.insert = async (chat) => {
  const sql = `
    INSERT INTO tg_chat 
      (chat_id, type, username, invite_link, access_hash, is_active, created_time, updated_time)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
      type = VALUES(type),
      username = VALUES(username),
      invite_link = VALUES(invite_link),
      access_hash = VALUES(access_hash),
      updated_time = NOW()
  `;
  return await db.query(sql, [
    chat.chat_id,
    chat.type,
    chat.username,
    chat.invite_link,
    chat.access_hash,
    chat.is_active
  ]);
}
