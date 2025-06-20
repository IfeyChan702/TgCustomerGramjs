const { stopListener, startListener } = require('./tgListenerService');
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

// 更新账户并根据 is_running 自动控制监听
exports.updateAccount = async (registerId, account) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE tg_accounts 
      SET is_running = ?
      WHERE registerId = ?
    `;
    const values = [account.is_running, registerId];

    db.query(sql, values, async (err, result) => {
      if (err) return reject(err);

      // 根据 is_running 控制监听
      try {
        if (Number(account.is_running) === 0) {
          await stopListener(registerId);
          console.log(`[监听] 已关闭: ${registerId}`);
        } else if (Number(account.is_running) === 1) {
          // 获取完整数据以重启监听
          db.query(
            `SELECT api_id, api_hash, session FROM tg_accounts WHERE registerId = ?`,
            [registerId],
            async (fetchErr, rows) => {
              if (fetchErr) return reject(fetchErr);
              const user = rows[0];
              if (user) {
                await startListener({
                  registerId,
                  apiId: user.api_id,
                  apiHash: user.api_hash,
                  session: user.session,
                });
                console.log(`[监听] 已开启: ${registerId}`);
              }
            }
          );
        }
      } catch (e) {
        console.error(`[监听异常] registerId=${registerId}`, e);
      }

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

