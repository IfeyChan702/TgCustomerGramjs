const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");
const { createClient } = require("redis");
const fs = require("fs");
const { NewMessage } = require("telegram/events");

// 远程 Redis 地址和密码（请换成你的真实配置）
const redisUrl = "redis://:test123456@192.168.3.77:44513"; // 有密码加:yourpassword@，无密码去掉

const client = createClient({ url: redisUrl });

client.on("error", (err) => console.log("Redis Client Error", err));

// const sessionStr = fs.readFileSync("./Session.txt", "utf8").trim();
const apiId = +25618648;
const apiHash = "fd7af9926f68f0724e659c1a096c1f3e";
const stringSession = new StringSession(""); // fill this later with the value from session.save()

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
      new Promise((resolve) => rl.question("Please enter your number: ", resolve)),
    password: async () =>
      new Promise((resolve) => rl.question("Please enter your password: ", resolve)),
    phoneCode: async () =>
      new Promise((resolve) => rl.question("Please enter the code you received: ", resolve)),
    onError: (err) => console.log(err),
  });

  console.log("You should now be connected.");
  console.log(client.session.save()); // Save this string to avoid logging in again

  // const messages = await client.getMessages(7711217827, {});
  // console.log("First Message:", messages[0].message);

  // 防止进程自动退出
  setInterval(() => {}, 100000);
})();
