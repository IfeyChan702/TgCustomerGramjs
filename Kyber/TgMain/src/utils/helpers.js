function makeRegisterKey(registerId) {
  return `tg:register:${registerId}`;
}

module.exports = { makeRegisterKey };
