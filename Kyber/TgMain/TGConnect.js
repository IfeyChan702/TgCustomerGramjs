const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const {startRedis, redis } = require("./src/models/redisModel");
const { makeRegisterKey } = require("./src/utils/helpers"); // Library for user input

//+85264395733
const apiId = 25618648; // Get from https://my.telegram.org/apps
const apiHash = "fd7af9926f68f0724e659c1a096c1f3e";
const registerId = "cb71ff13-9d9a-48a4-90a6-0e3dd7c2a26f";

const session = new StringSession(""); // Store session
// Start Redis connection
startRedis();

async function fetchMessages() {  const data = await redis.hGetAll(makeRegisterKey(registerId));
  const session = new StringSession(data.session);
  const client = new TelegramClient(session, Number(data.apiId), data.apiHash, { connectionRetries: 5 });
  // const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });

  // await client.start({
  //   phoneNumber: async () => await input.text("Enter phone number: "),
  //   password: async () => await input.text("Enter password: "),
  //   phoneCode: async () => await input.text("Enter code sent to Telegram: "),
  //   onError: (err) => console.error(err),
  // });

  await client.start();

  const dialogs = await client.getDialogs(); // Fetch all chats

  dialogs.forEach((dialog) => {
      console.log(`ID: ${dialog.id}, Name: ${dialog.title}, Type: ${dialog.entity.className}`);
  });
}

fetchMessages();
