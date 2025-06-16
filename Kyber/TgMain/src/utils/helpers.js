function makeRegisterKey(registerId) {
  return `tg:register:${registerId}`;
}

// src/utils/helpers.js
const flows = {}; // Tracks registration promises

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}
module.exports = { makeRegisterKey, flows, createDeferred };