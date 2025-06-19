const db = require('../models/mysqlModel');

// 查询所有商户群，可选关键词模糊搜索 group_name
exports.getAllMerchants = (keyword = '') => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM tg_groups_merchant';
    const values = [];

    if (keyword) {
      sql += ' WHERE group_name LIKE ? OR tg_account_id LIKE ?';
      values.push(`%${keyword}%`);
    }

    db.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// 新增商户群
exports.createMerchant = (merchant) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO tg_groups_merchant 
      (tg_account_id, chat_id, group_name, role, template_id, created_at) 
      VALUES (?, ?, ?, ?, ?, NOW())`;

    const values = [
      merchant.tg_account_id,
      merchant.chat_id,
      merchant.group_name,
      merchant.role ?? 'merchant',
      merchant.template_id,
    ];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// 更新商户群
exports.updateMerchant = (id, merchant) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE tg_groups_merchant 
      SET tg_account_id = ?, chat_id = ?, group_name = ?, role = ?, template_id = ? 
      WHERE id = ?`;

    const values = [
      merchant.tg_account_id,
      merchant.chat_id,
      merchant.group_name,
      merchant.role ?? 'merchant',
      merchant.template_id,
      id,
    ];

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// 删除商户群
exports.deleteMerchant = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM tg_groups_merchant WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
