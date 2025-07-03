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

    if (status !== null) {
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

    if (startTime && endTime) {
      baseSQL += ` AND o.created_time BETWEEN ? AND ?`;
      values.push(startTime, endTime);
      countValues.push(startTime, endTime);
    }

    if (keyword) {
      baseSQL += ` AND (
        MATCH(gm.group_name) AGAINST (? IN BOOLEAN MODE) OR
        MATCH(gc.group_name) AGAINST (? IN BOOLEAN MODE) OR
        MATCH(tr.match_rule) AGAINST (? IN BOOLEAN MODE)
      )`;
      values.push(keyword, keyword, keyword);
      countValues.push(keyword, keyword, keyword);
    }

    const countSQL = `SELECT COUNT(*) AS total ` + baseSQL;
    const dataSQL = `SELECT o.*, gm.group_name AS merchant_group_name, gc.group_name AS channel_group_name, tr.reply_text 
                     AS reply_text, tr.match_rule AS match_rule ` + baseSQL + ` 
                     ORDER BY o.created_time DESC 
                     LIMIT ? OFFSET ?`;

    values.push(size, offset);

    db.query(countSQL, countValues, (err, countResult) => {
      if (err) return reject(err);

      db.query(dataSQL, values, (err, dataResult) => {
        if (err) return reject(err);

        resolve({
          total: countResult[0].total, data: dataResult
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
        VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)
    `;

    const values = [
      order.channelMsgId ?? null,
      order.merchantMsgId ?? null,
      order.merchantChatId,
      order.channelGroupId,
      order.orderstatus, // 默认 status 为 0（未处理）
      order.merchantOrderId,
      order.tgReplyId ?? null
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



