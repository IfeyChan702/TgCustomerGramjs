const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { makeRegisterKey } = require('../utils/helpers');
const { redis } = require('../models/redisModel');
const uuid = require('uuid');
const axios = require('axios');
const tgAccountService = require('../service/tgAccountService');


const flows = {};

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

async function initRegister(req, res) {
  const { apiId, apiHash } = req.body;
  if (!apiId || !apiHash) return res.status(400).json({ msg: '缺少参数' });

  const registerId = uuid.v4();
  await redis.hSet(makeRegisterKey(registerId), { apiId, apiHash, status: 'waitPhone',isRunning: 'false'});

  flows[registerId] = {
    phone: createDeferred(),
    code: createDeferred(),
    password: createDeferred(),
  };

  doRegisterFlow(registerId);
  res.json({ registerId });
}

async function submitPhone(req, res) {
  const { registerId, phone } = req.body;
  if (!registerId || !phone) return res.status(400).json({ msg: '缺少参数' });

  await redis.hSet(makeRegisterKey(registerId), { phone, status: 'waitCode',isRunning: 'false'});
  flows[registerId]?.phone?.resolve(phone);

  res.json({ msg: 'ok' });
}

async function submitCode(req, res) {
  const { registerId, code } = req.body;
  if (!registerId || !code) return res.status(400).json({ msg: '缺少参数' });

  await redis.hSet(makeRegisterKey(registerId), { code, status: 'verifying',isRunning: 'false'});
  flows[registerId]?.code?.resolve(code);

  res.json({ msg: 'ok' });
}

async function getStatus(req, res) {
  const { registerId } = req.query;
  if (!registerId) return res.status(400).json({ msg: '缺少参数' });

  const result = await redis.hGetAll(makeRegisterKey(registerId));
  res.json(result);
}

async function doRegisterFlow(registerId) {
  const data = await redis.hGetAll(makeRegisterKey(registerId));
  if (!data.apiId || !data.apiHash) {
    await redis.hSet(makeRegisterKey(registerId), { status: 'fail', err: '参数不全' });
    return;
  }

  try {
    const client = new TelegramClient(new StringSession(''), Number(data.apiId), data.apiHash, { connectionRetries: 5 });

    await client.start({
      phoneNumber: () => flows[registerId]?.phone?.promise,
      phoneCode: () => flows[registerId]?.code?.promise,
      password: () => '',
      onError: (err) => console.log('GramJS Error:', err),
    });

    const session = client.session.save();
    const finalData = await redis.hGetAll(makeRegisterKey(registerId));
    const Id = registerId.slice(0, 8);
    // 写入数据库
    await tgAccountService.createAccount({
      registerId,
      Id,
      api_id: data.apiId,
      api_hash: data.apiHash,
      session,
      is_running: 1,
      created_at: new Date(),
      code: finalData.code,
      phone: finalData.phone,
      status: 'done',
    });
    await redis.hSet(makeRegisterKey(registerId), { status: 'done', isRunning: 'true' });

    console.log(`[SUCCESS] Account saved: ${registerId}`);
  } catch (e) {
    console.error(`[ERROR] 注册失败 ${registerId}`, e);
  } finally {
    delete flows[registerId];
  }
}


module.exports = {
  initRegister,
  submitPhone,
  submitCode,
  getStatus
};
