const axios = require("axios");
const { redis } = require("../../../../models/redisModel");

async function requestUrl(command, userArgs) {
  try {

  } catch (e) {
    console.error("请求失败：", e);
    return "系统繁忙!";
  }
}


module.exports = {
  requestUrl
};
