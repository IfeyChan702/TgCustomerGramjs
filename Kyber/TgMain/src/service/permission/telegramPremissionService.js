const { redis } = require('../../models/redisModel');
const db = require('../../models/mysqlModel');

const REDIS_KEY = 'telegram:permission';

const PERMISSION = {
  NORMAL: 0,
  SUPERUSER: 1,
  ADMIN: 2
};

/**
 * telegram权限服务
 */
const TelegramPermissionService = {
  PERMISSION,

  /** 获取某个账号的权限等级 */
  async getPermission(telegramId) {
    if (!telegramId) return PERMISSION.NORMAL;

    try {
      const permStr = await redis.hGet(REDIS_KEY, telegramId.toString());
      return parseInt(permStr || "0");
    } catch (err) {
      console.error('[ERROR] Redis hGet 出错:', err);
      return PERMISSION.NORMAL;
    }
  },

  /** 设置某个账号的权限 */
  async setPermission(telegramId, permissionLevel) {
    if (!telegramId) return;

    try {
      const keyStr = telegramId.toString();
      const permStr = permissionLevel.toString();
      return await redis.hSet(REDIS_KEY, keyStr, permStr);
    } catch (err) {
      console.error('[ERROR] Redis hSet 出错:', err);
      throw err;
    }
  },

  /** 删除某个账号的权限缓存 */
  async removePermission(telegramId) {
    if (!telegramId) return;

    try {
      return await redis.hDel(REDIS_KEY, telegramId.toString());
    } catch (err) {
      console.error('[ERROR] Redis hDel 出错:', err);
      throw err;
    }
  },

  /** 批量初始化权限数据：从数据库 tg_accounts 表读取 */
  async initPermissionsFromDatabase() {
    const sql = `SELECT telegram_id, telegram_permission FROM tg_accounts`;

    return new Promise((resolve, reject) => {
      db.query(sql, async (err, rows) => {
        if (err) {
          console.error('[ERROR] 查询 tg_accounts 失败:', err);
          return reject(err);
        }

        try {
          let count = 0;
          for (const row of rows) {
            const id = row.telegram_id;
            const perm = row.telegram_permission ?? 0;

            if (typeof id !== 'number' && typeof id !== 'string') {
              console.warn(`[WARN] 跳过无效 telegram_id:`, row);
              continue;
            }

            const idStr = id.toString();
            const permStr = perm.toString();

            await redis.hSet(REDIS_KEY, idStr, permStr);
            count++;
          }

          console.log(`[INFO] 成功初始化权限缓存，共 ${count} 条`);
          resolve(true);
        } catch (e) {
          console.error('[ERROR] 写入 Redis 权限缓存失败:', e);
          reject(e);
        }
      });
    });
  },

  /** 是否为超级用户 */
  async isSuperuser(telegramId) {
    const perm = await this.getPermission(telegramId);
    return perm === PERMISSION.SUPERUSER;
  },

  /** 是否为管理员或超级用户 */
  async isAdminOrSuperuser(telegramId) {
    const perm = await this.getPermission(telegramId);
    return perm === PERMISSION.ADMIN || perm === PERMISSION.SUPERUSER;
  }
};

module.exports = TelegramPermissionService;
