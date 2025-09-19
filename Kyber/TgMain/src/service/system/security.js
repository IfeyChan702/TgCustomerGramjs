const crypto = require("crypto");
const { hmacKey } = require("../../config/botConfig");

function sign(raw) {
  return crypto.createHmac("sha256", hmacKey).update(raw).digest("hex").slice(0, 16);
}

function verify(action, orderId, merchantId, sig) {
  return sign(`${action}|${orderId}|${merchantId}`) === sig;
}

module.exports = { sign, verify };
