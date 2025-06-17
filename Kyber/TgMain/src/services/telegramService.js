const { redis } = require("../models/redisModel");
const { makeRegisterKey, flows } = require("../utils/helpers");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const chatIds = [-4893629782, -4658228791];
const axios = require("axios");


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


//
// // Get the ID of Group
//     const dialogs = await client.getDialogs();
//     dialogs.forEach((dialog) => {
//       if (chatIds.includes(dialog.id)) {
//         console.log(`ID: ${dialog.id}, Name: ${dialog.title}, TZype: ${dialog.entity.className}`);
//       }
//     });
//
//
//
//     // for (const chatId of chatIds) {
//       console.log(`Fetching messages from Chat ID: -4893629782`);
//       const messages = await client.getMessages(-4893629782, { limit: 50 });
//
//       for (const msg of messages) {
//         console.log(`Chat ID: -4893629782, Message ID: ${msg.id}, Sender: ${msg.senderId}, Text: ${msg.text}`);
//
//         try {
//           const url = `https://bi.humideah.com/bi/payin/check?order_id=${msg.text}`;
//           const response = await axios.get(url);
//           if (response.data && response.data.channel_order_id) {
//             const message = `Channel Order ID: ${response.data.channel_order_id}`;
//             const payResult = response.data.payResult;
//             await client.forwardMessages(-4658228791, {messages:[msg.id], fromPeer:-4893629782});
//             await client.sendMessage(-4658228791, { message });
//             await client.sendMessage(-4893629782, { message: payResult, replyTo: msg.id });
//             console.log(`Forwarded: ${message}`);
//           } else {
//             console.log("channel_order_id not found in response.");
//           }
//         } catch (error) {
//           console.error("Error fetching data:", error.message);
//         }
//
//
//       }
//     // }
//

    //
    // // 监听机制
    // console.log("Bot is listening for messages...");
    //
    // client.addEventHandler(async (event) => {
    //   const message = event.message;
    //
    //   if (message && message.chatId === -4893629782 && message.media) {
    //     console.log("Image detected, modifying caption...");
    //
    //     const newCaption = "This is the modified caption."; // Change the caption here
    //
    //     // Send the modified media to the target chat
    //     await client.sendFile(-4658228791, {
    //       file: message.media,
    //       caption: newCaption,
    //     });
    //
    //     console.log("Message sent successfully!");
    //   }
    // }, new Api.Updates());
    //
    // // 防止进程自动退出
    // setInterval(() => {}, 100000);
  } catch (e) {
    await redis.hSet(makeRegisterKey(registerId), { status: 'fail', err: e.message });
    console.log(`[FAIL] Register error: ${registerId},`, e);
  } finally {
    // 注册流程完毕后删除 Promise，防内存泄漏
    delete flows[registerId];
  }
}
module.exports = { doRegisterFlow };