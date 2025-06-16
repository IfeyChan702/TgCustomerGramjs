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
