const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const {startRedis, redis } = require("./src/models/redisModel");
const { makeRegisterKey } = require("./src/utils/helpers"); // Library for user input

//
// +918302444254
const apiId = 23539286; // Get from https://my.telegram.org/apps
const apiHash = "02950d6f4ebe5564112b82243315fa59";
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
    if (dialog.title.includes("Channel") || dialog.title.includes("Merchants")) {
      console.log(`ID: ${dialog.id}, Name: ${dialog.title}, Type: ${dialog.entity.className}`);
    }
    if (dialog.title === "Channel test" ) {
      redis.hSet("tg:channel:116", {  id: 116, dialog:dialog.id.toString()});
    }
    if (dialog.title === "Channel test2") {
      redis.hSet("tg:channel:117", { id: 117, dialog:dialog.id.toString()});
    }
    if (dialog.title === "Channel test3" ) {
      redis.hSet("tg:channel:125", { id: 125, dialog:dialog.id.toString()});
    }
    if (dialog.title === "Merchants test" ) {
      redis.hSet("tg:merchants:216", {  id:216, dialog:dialog.id.toString()});
    }
    if (dialog.title === "Merchants test2" ) {
      redis.hSet("tg:merchants:227", {  id:227, dialog:dialog.id.toString()});
    }
    if (dialog.title === "Merchants test3" ) {
      redis.hSet("tg:merchants:238", {  id:238, dialog:dialog.id.toString()});
    }
  });
}

fetchMessages();
