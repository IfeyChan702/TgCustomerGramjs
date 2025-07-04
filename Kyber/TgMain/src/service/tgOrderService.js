const db = require("../models/mysqlModel");

/**
 * 分页查询，模糊查询，条件查询order数据
 * @param params
 * @returns {Promise<unknown>}
 */
exports.getPageOrders = (params = {}) => {
  return new Promise((resolve, reject) => {
    const {
      keyword = "",
      page = 1,
      size = 10,
      status = null,
      merchantChatId = null,
      merchantOrderId = null,
      channelId = null,
      startTime = null,
      endTime = null
    } = params;

    const offset = (page - 1) * size;
    const values = [];
    const countValues = [];

    let baseSQL = `
      FROM tg_order o
      LEFT JOIN tg_groups_merchant gm ON o.merchant_chat_id = gm.chat_id
      LEFT JOIN tg_groups_channel gc ON o.channel_group_id = gc.group_id
      LEFT JOIN tg_reply tr ON o.tg_reply_id = tr.id
      WHERE 1 = 1
    `;

    if (merchantOrderId !== null && merchantOrderId !== undefined) {
      baseSQL += ` AND o.merchant_order_id = ?`;
      values.push(merchantOrderId);
      countValues.push(merchantOrderId);
    }

    if (status !== null && status !== undefined) {
      baseSQL += ` AND o.status = ?`;
      values.push(status);
      countValues.push(status);
    }

    if (merchantChatId !== null) {
      baseSQL += ` AND o.merchant_chat_id = ?`;
      values.push(merchantChatId);
      countValues.push(merchantChatId);
    }

    if (channelId !== null) {
      baseSQL += ` AND o.channel_group_id = ?`;
      values.push(channelId);
      countValues.push(channelId);
    }

    if (startTime?.trim() && endTime?.trim()) {
      baseSQL += ` AND o.created_time BETWEEN ? AND ?`;
      values.push(startTime, endTime);
      countValues.push(startTime, endTime);
    }

    if (keyword) {
      const likeKeyword = `%${keyword}%`;
      baseSQL += ` AND (
        gm.group_name LIKE ? OR
        gc.group_name LIKE ? OR
        tr.match_rule LIKE ?
      )`;
      values.push(likeKeyword, likeKeyword, likeKeyword);
      countValues.push(likeKeyword, likeKeyword, likeKeyword);
    }

    const countSQL = `SELECT COUNT(*) AS total ` + baseSQL;
    const dataSQL = `SELECT o.*, gm.group_name AS merchant_group_name, gc.group_name AS channel_group_name, tr.reply_text 
                     AS reply_text, tr.match_rule AS match_rule ` + baseSQL + ` 
                     ORDER BY o.created_time DESC 
                     LIMIT ? OFFSET ?`;

    values.push(size, offset);

    db.query(countSQL, countValues, (err, countResult) => {
      if (err) {
        console.error("Count SQL Error:", err);
        return reject(err);
      }

      db.query(dataSQL, values, (err, dataResult) => {
        if (err) {
          console.error("Data SQL Error:", err);
          return reject(err);
        }

        resolve({
          total: countResult[0].total,
          data: dataResult
        });
      });
    });
  });
};

/**
 * 插入订单
 * @param order
 * @returns {Promise<void>}插入成功返回 insertId
 */
exports.insertOrder = (order) => {
  return new Promise((resolve, reject) => {
    const sql = `
        INSERT INTO tg_order
        (channel_msg_id, merchant_msg_id, merchant_chat_id, channel_group_id, status, created_time, merchant_order_id,
         tg_reply_id)
        VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
    `;

    const values = [
      order.channelMsgId ?? null,
      order.merchantMsgId ?? null,
      order.merchantChatId,
      order.channelGroupId,
      order.orderStatus, // 默认 status 为 0（未处理）
      order.merchantOrderId,
      order.tgReplyId ?? 0
    ];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

/**
 * 删除订单（根据订单主键id）
 * @param id
 * @returns {Promise<unknown>}
 */
exports.deleteOrderById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE
                 FROM tg_order
                 WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};



