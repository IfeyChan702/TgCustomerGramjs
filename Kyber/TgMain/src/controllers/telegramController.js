const { uuid } = require('uuid');
const { flows, createDeferred } = require('../utils/helpers');
const { redis } = require('../models/redisModel');
const { makeRegisterKey } = require('../utils/helpers');
const { doRegisterFlow } = require('../services/telegramService');

exports.initTelegramRegister = async (req, res) => {
  const { apiId, apiHash } = req.body;
  if (!apiId || !apiHash) return res.status(400).json({ msg: '缺少参数' });

  const registerId = uuid.v4();

  // Store in Redis
  await redis.hSet(makeRegisterKey(registerId), { apiId, apiHash, status: 'waitPhone' });

  // Create promises for the registration flow
  flows[registerId] = {
    phone: createDeferred(),
    code: createDeferred(),
    password: createDeferred(),
  };

  // Start registration process
  doRegisterFlow(registerId);

  res.json({ registerId });
};


exports.submitPhoneNumber = async (req, res) => {
  const { registerId, phone } = req.body;
  if (!registerId || !phone) return res.status(400).json({ msg: '缺少参数' });

  await redis.hSet(makeRegisterKey(registerId), { phone, status: 'waitCode' });

  // Resolve phone promise if exists
  if (flows[registerId]?.phone) flows[registerId].phone.resolve(phone);

  res.json({ msg: 'ok' });
};

exports.submitVerificationCode = async (req, res) => {
  const { registerId, code } = req.body;
  if (!registerId || !code) return res.status(400).json({ msg: '缺少参数' });

  await redis.hSet(makeRegisterKey(registerId), { code, status: 'verifying' });

  // Resolve code promise if exists
  if (flows[registerId]?.code) flows[registerId].code.resolve(code);

  res.json({ msg: 'ok' });
};

exports.getRegistrationStatus = async (req, res) => {
  const { registerId } = req.query;
  if (!registerId) return res.status(400).json({ msg: '缺少参数' });

  const result = await redis.hGetAll(makeRegisterKey(registerId));
  res.json(result);
};