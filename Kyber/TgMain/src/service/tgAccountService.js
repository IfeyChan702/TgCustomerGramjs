const db = require('../models/mysqlModel');

// 查询所有账户，支持关键词模糊搜索（模糊匹配 registerId、phone、status）
exports.getAllAccounts = (keyword = '') => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM tg_accounts';
    const values = [];

    if (keyword) {
      sql += ' WHERE registerId LIKE ? OR phone LIKE ? OR api_id LIKE ?';
      const like = `%${keyword}%`;
      values.push(like, like, like);
    }

    db.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// 新增账户
exports.createAccount = (account) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO tg_accounts 
        (registerId, Id, api_id, api_hash, session, is_running, created_at, code, phone, status, telegram_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      account.registerId,
      account.Id,
      account.api_id,
      account.api_hash,
      account.session,
      account.is_running,
      account.created_at || new Date(),
      account.code,
      account.phone,
      account.status,
      account.telegram_id
    ];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// 更新账户
exports.updateAccount = (registerId, account) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE tg_accounts 
      SET is_running = ?
      WHERE registerId = ?
    `;
    const values = [account.is_running, registerId];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// 删除账户
exports.deleteAccount = (registerId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM tg_accounts WHERE registerId = ?';
    db.query(sql, [registerId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

