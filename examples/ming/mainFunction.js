const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

async function initializeTelegramSessionStep1(apiId, apiHash, phoneNumber) {
  const stringSession = new StringSession("");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phoneNumber,
    // phoneCode: async () => "99999",
    onError: (err) => console.log(err),
  });

  // console.log("You are now connected.");
  // console.log("Session String:", client.session.save());

  // return client.session.save(); // Returning the session string
}

async function initializeTelegramSessionStep2(apiId, apiHash, phoneNumber, phoneCode) {
  const stringSession = new StringSession("");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phoneNumber,
    phoneCode: async () => phoneCode,
    onError: (err) => console.log(err),
  });

  console.log("You are now connected.");
  console.log("Session String:", client.session.save());

  return client.session.save(); // Returning the session string
}


// Ensure functions are exported
module.exports = { initializeTelegramSessionStep1, initializeTelegramSessionStep2 };

// Example usage:
// (async () => {
//   const apiId = 23539286;
//   const apiHash = "02950d6f4ebe5564112b82243315fa59";
//   const phoneNumber = "+1234567890"; // Replace with your actual phone number
//   const phoneCode = "123456"; // Replace with the actual received code
//
//   const sessionString = await initializeTelegramSession(apiId, apiHash, phoneNumber, phoneCode);
//   console.log("Final Session String:", sessionString);
// })();
