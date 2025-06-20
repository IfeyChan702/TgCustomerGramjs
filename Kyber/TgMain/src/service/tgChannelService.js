const db = require('../models/mysqlModel');

// 查询所有渠道群（支持关键词模糊搜索）
exports.getAllChannels = (keyword = '') => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM tg_groups_channel';
    const values = [];

    if (keyword) {
      sql += ' WHERE group_name LIKE ? OR chat_id LIKE ? OR tg_account_id LIKE ?';
      const likeKeyword = `%${keyword}%`;
      values.push(likeKeyword, likeKeyword, likeKeyword);
    }

    db.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// 新增渠道群
exports.createChannel = (channel) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO tg_groups_channel 
        (tg_account_id, group_id, chat_id, group_name, role, template_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const values = [
      channel.tg_account_id,
      channel.group_id,
      channel.chat_id,
      channel.group_name,
      channel.role ?? 'channel',
      channel.template_id,
    ];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// 更新渠道群
exports.updateChannel = (id, channel) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE tg_groups_channel 
      SET tg_account_id = ?, group_id = ?, chat_id = ?, group_name = ?, role = ?, template_id = ?
      WHERE id = ?
    `;
    const values = [
      channel.tg_account_id,
      channel.group_id,
      channel.chat_id,
      channel.group_name,
      channel.role ?? 'channel',
      channel.template_id,
      id,
    ];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// 删除渠道群
exports.deleteChannel = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM tg_groups_channel WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
