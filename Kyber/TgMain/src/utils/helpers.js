function makeRegisterKey(registerId) {
  return `tg:register:${registerId}`;
}

function makeChannelKey(ChannelId) {
  return `tg:channel:${ChannelId}`;
}


// src/utils/helpers.js
const flows = {}; // Tracks registration promises

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}
module.exports = { makeRegisterKey,makeChannelKey, flows, createDeferred };