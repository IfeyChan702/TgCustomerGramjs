const { stopListener, startListener } = require("./tgListenerService");
const db = require("../models/mysqlModel");
const telegramPermissionService = require("../service/permission/telegramPremissionService");
const { getRawAsset } = require("node:sea");

// 查询所有账户，支持关键词模糊搜索（模糊匹配 registerId、phone、status）
exports.getAllAccounts = (keyword = "") => {
  return new Promise((resolve, reject) => {
    let sql = "SELECT * FROM tg_accounts";
    const values = [];

    if (keyword) {
      sql += " WHERE registerId LIKE ? OR phone LIKE ? OR api_id LIKE ?";
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

    const permission = Number(account.telegram_permission);

    if (![0, 1, 2].includes(permission)) {
      console.warn(`[WARN] 非法权限值: ${account.telegram_permission}，已强制设置为普通用户`);
    }

    const normalizedPermission = [0, 1, 2].includes(permission) ? permission : 0;
    const sql = `
        INSERT INTO tg_accounts
        (registerId, Id, api_id, api_hash, session, is_running, created_at, code, phone, status, telegram_id,telegram_permission)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
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
      account.telegram_id,
      normalizedPermission
    ];

    db.query(sql, values, async (err, result) => {
      if (err) return reject(err);

      try {

        if (!account.telegram_id) {
          console.warn('[WARN] 缺失 telegram_id，跳过 Redis 权限设置');
          return resolve(result);
        }

        await telegramPermissionService.setPermission(
          account.telegram_id,
          normalizedPermission
        );
        resolve(result); // 放到 try 成功后
      } catch (e) {
        console.warn('[WARN] 插入账号成功但缓存写入失败:', e);
        resolve(result); // Redis 写入失败也返回主流程成功
      }
    });
  });
};
/**
 * 更新account的操作
 * @param registerId
 * @param account
 * @return {Promise<unknown>}
 */
exports.updateAccount = async (registerId, account) => {
  return new Promise((resolve, reject) => {
    const fields = ['is_running'];
    const values = [account.is_running];

    let shouldUpdatePermission = false;
    if ('telegram_permission' in account) {
      fields.push('telegram_permission');
      values.push(account.telegram_permission);
      shouldUpdatePermission = true;
    }

    const sql = `
      UPDATE tg_accounts
      SET ${fields.map(f => `${f} = ?`).join(', ')}
      WHERE registerId = ?
    `;
    values.push(registerId);

    db.query(sql, values, async (err, result) => {
      if (err) return reject(err);

      try {
        const fetchSql = `
          SELECT telegram_id, api_id, api_hash, session
          FROM tg_accounts
          WHERE registerId = ?
        `;
        db.query(fetchSql, [registerId], async (fetchErr, rows) => {
          if (fetchErr) return reject(fetchErr);
          const user = rows[0];
          if (!user) return reject(new Error('账号不存在'));

          const telegramId = user.telegram_id;
          const perm = account.telegram_permission;

          if (shouldUpdatePermission && telegramId && perm !== undefined && perm !== null) {
            try {
              await telegramPermissionService.setPermission(telegramId, perm);
              console.log(`[Redis] 权限已更新 telegram_id=${telegramId}, permission=${perm}`);
            } catch (e) {
              console.warn(`[Redis] 权限写入失败 telegram_id=${telegramId}:`, e);
            }
          }

          const Id = registerId.slice(0, 8);
          if (Number(account.is_running) === 0) {
            await stopListener(Id);
            console.log(`[监听] 已关闭: ${registerId}`);
          } else if (Number(account.is_running) === 1) {
            if (user.api_id && user.api_hash && user.session) {
              await startListener(Id);
              console.log(`[监听] 已开启: ${registerId}`);
            } else {
              console.warn(`[监听] 缺失启动参数，无法开启: ${registerId}`);
            }
          }

          return resolve(result);
        });
      } catch (e) {
        console.error(`[更新异常] registerId=${registerId}`, e);
        reject(e);
      }
    });
  });
};

/**
 * 根据registerId删除数据
 * @param registerId
 * @return {Promise<unknown>}
 */
exports.deleteAccount = (registerId) => {
  return new Promise((resolve, reject) => {
    const querySql = "SELECT telegram_id FROM tg_accounts WHERE registerId = ?";
    db.query(querySql, [registerId], (queryErr, rows) => {
      if (queryErr) return reject(queryErr);
      const telegramId = rows[0]?.telegram_id;

      const deleteSql = "DELETE FROM tg_accounts WHERE registerId = ?";
      db.query(deleteSql, [registerId], async (deleteErr, result) => {
        if (deleteErr) return reject(deleteErr);

        if (telegramId) {
          try {
            await telegramPermissionService.removePermission(telegramId);
            console.log(`[Redis] 已删除 telegram_id=${telegramId} 的权限缓存`);
          } catch (e) {
            console.warn(`[Redis] 删除权限缓存失败 telegram_id=${telegramId}:`, e);
          }
        }
        resolve(result);
      });
    });
  });
};

