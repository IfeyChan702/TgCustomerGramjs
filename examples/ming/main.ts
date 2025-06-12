import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as fs from "fs";
import { NewMessage } from "telegram/events";
import * as readline from "readline";

const sessionStr = fs.readFileSync("./Session.txt", "utf8").trim();
const apiId = 22059335;
const apiHash = "5eb343d4aa291469585740ecccba1852";
const stringSession = new StringSession(sessionStr); // fill this later with the value from session.save()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  console.log("Loading interactive example...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () =>
      new Promise((resolve) =>
        rl.question("Please enter your number: ", resolve)
      ),
    password: async () =>
      new Promise((resolve) =>
        rl.question("Please enter your password: ", resolve)
      ),
    phoneCode: async () =>
      new Promise((resolve) =>
        rl.question("Please enter the code you received: ", resolve)
      ),
    onError: (err) => console.log(err),
  });
  console.log("You should now be connected.");
  console.log(client.session.save()); // Save this string to avoid logging in again
  // await client.sendMessage(5860047689, { message: "Hi!辉哥" });
  // 持续监听来自 8088901247 的消息
  client.addEventHandler(
    async (event) => {
      // 判断 senderId 是否为 8088901247
      if (event.message.senderId && event.message.senderId.valueOf() === 8088901247) {
        const msgText = event.message.text || "";
        const fromPeer = (await event.message.getInputChat())!;
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
})();
