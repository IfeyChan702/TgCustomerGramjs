const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');
const { redis } = require('../models/redisModel');
const { makeRegisterKey } = require('../utils/helpers');
const tgAccountService = require('../service/tgAccountService'); // 你已有的服务，用于查 MySQL

async function getGroupsByRegisterId(registerId) {
  let data = null;

  // 先从数据库中查询账户信息
  try {
    data = await tgAccountService.getAllAccounts(registerId);
  } catch (err) {
    console.warn('[WARN] 查询数据库失败，尝试从 Redis 获取:', err.message);
  }

  // 如果数据库查不到，则尝试 Redis
  if (!data || !data.session) {
    const key = makeRegisterKey(registerId);
    const redisData = await redis.hGetAll(key);
    console.log('[DEBUG] Redis fallback data:', redisData);

    if (!redisData || !redisData.session) {
      throw new Error('未找到该 registerId 对应的 session');
    }

    data = {
      session: redisData.session,
      api_id: redisData.apiId,
      api_hash: redisData.apiHash,
    };
  }

  // 创建 TelegramClient 并连接
  const client = new TelegramClient(
    new StringSession(data.session),
    Number(data.api_id),
    data.api_hash,
    { connectionRetries: 5 }
  );

  await client.connect();

  // 获取对话列表并筛选群组
  const dialogs = await client.getDialogs({});
  const groups = dialogs.filter(
    (d) =>
      d.isGroup ||
      (d.isChannel && d.entity instanceof Api.Channel && d.entity.megagroup)
  );

  const groupList = groups.map((g) => ({
    id: g.id,
    name: g.title,
  }));

  await client.disconnect();
  return groupList;
}

module.exports = { getGroupsByRegisterId };
