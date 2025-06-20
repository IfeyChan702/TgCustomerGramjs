const db = require('../models/mysqlModel');

exports.getAllReplies = (keyword = '') => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM tg_reply';
    const values = [];

    if (keyword) {
      sql += ' WHERE name LIKE ? OR match_rule LIKE ? OR reply_text LIKE ?';
      const likeKeyword = `%${keyword}%`;
      values.push(likeKeyword, likeKeyword, likeKeyword);
    }

    db.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.createReply = (reply) => {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO tg_reply (name, match_rule, reply_text) VALUES (?, ?, ?)';
    const values = [reply.name, reply.match_rule, reply.reply_text];
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

exports.updateReply = (id, reply) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE tg_reply SET name = ?, match_rule = ?, reply_text = ? WHERE id = ?';
    const values = [reply.name, reply.match_rule, reply.reply_text, id];
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

exports.deleteReply = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM tg_reply WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
