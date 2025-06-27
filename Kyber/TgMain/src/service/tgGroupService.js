const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');
const tgAccountService = require('../service/tgAccountService');

// 通用超时包装器
function withTimeout(promise, timeoutMs, timeoutMsg = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs)
    ),
  ]);
}

async function getGroupsByRegisterId(registerId) {
  const resultList = await tgAccountService.getAllAccounts(registerId);
  const data = resultList[0]; // 取第一个账户

  if (!data || !data.session || !data.api_id || !data.api_hash) {
    console.error('[INVALID DATA]', data);
    throw new Error('数据库中未找到有效的账户信息');
  }

  const client = new TelegramClient(
    new StringSession(data.session),
    Number(data.api_id),
    data.api_hash,
    { connectionRetries: 5 }
  );

  console.time('[CONNECT]');
  await withTimeout(client.connect(), 30000, '连接 Telegram 超时');
  console.timeEnd('[CONNECT]');

  console.time('[GET_DIALOGS]');
  const dialogs = await withTimeout(
    client.getDialogs({}),
    30000,
    '获取群组对话超时'
  );
  console.timeEnd('[GET_DIALOGS]');

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
