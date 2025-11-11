const db = require("../../../models/mysqlModel");

exports.insert = async (name, username, token, env, isActive= 1) => {

  if (!name || !username || !token) {
    throw new Error("name、username、token 不能为空");
  }
  const sql = `
      INSERT INTO tg_bots (name, username, token, env, is_active)
      VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
                               name = VALUES(name),
                               token = VALUES(token),
                               env = VALUES(env),
                               is_active = VALUES(is_active),
                               updated_at = NOW()
  `;
  const values = [name, username, token, env, isActive];
  try {
    const [result] = await db.query(sql, values);
    return result;
  } catch (err) {
    console.error("sysWithdrawContextService-insert() error:", err);
    throw err;
  }
};
