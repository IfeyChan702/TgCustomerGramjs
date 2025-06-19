const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');
const { redis } = require('../models/redisModel');
const { makeRegisterKey } = require('../utils/helpers');

async function getGroupsByRegisterId(registerId) {
  const key = makeRegisterKey(registerId);
  const data = await redis.hGetAll(key);

  //  打印 Redis key 和内容
  console.log(`[DEBUG] Redis key: ${key}`);
  console.log('[DEBUG] Redis data:', data);

  if (!data || !data.session) {
    throw new Error('未找到该 registerId 对应的 session');
  }

  const client = new TelegramClient(
    new StringSession(data.session),
    Number(data.apiId),
    data.apiHash,
    { connectionRetries: 5 }
  );

  await client.connect();

  const dialogs = await client.getDialogs({});
  const groups = dialogs.filter(
    (d) =>
      d.isGroup || (d.isChannel && d.entity instanceof Api.Channel && d.entity.megagroup)
  );

  const groupList = groups.map((g) => ({
    id: g.id,
    name: g.title,
  }));

  await client.disconnect();
  return groupList;
}

module.exports = { getGroupsByRegisterId };

