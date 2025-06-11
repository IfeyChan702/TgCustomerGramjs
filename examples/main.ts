import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import readline from "readline";
import * as fs from "fs";
import { NewMessage } from "telegram/events";

const sessionStr = fs.readFileSync("./Session.txt", "utf8").trim();
const apiId = 23539286;
const apiHash = "02950d6f4ebe5564112b82243315fa59";
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

  // const messages = await client.getMessages(7711217827, {});
  // console.log("First Message:", messages[0].message);

  client.addEventHandler(
    async (event) => {
      // 判断 senderId 是否为 7711217827
      if (event.message.senderId && event.message.senderId.valueOf() === 7711217827) {
        console.log("收到来自 7711217827 的消息：", event.message.text);

        // Forward the message to 8088901247
        await client.forwardMessages(8088901247, {messages:event.message.id,
          fromPeer:(await event.message.getInputChat())!
        });

        // 再发一条“hello world”
        await client.sendMessage(7700169264, { message: "hello world" });

        console.log("消息已转发到 8088901247");

      }
    },
    new NewMessage({})
  );

  // 防止进程自动退出
  setInterval(() => {}, 100000);
  // await client.sendMessage(6612558831, { message: "Hi!mingC" });
})();
