const tgDbService = require("../tgDbService");
const axios = require("axios");
const { redis } = require("../../models/redisModel");


const ERSAN_TOKEN_KEY = "ersan:accessToken";

/**
 * 处理命令型的请求
 * @param command
 * @param userArgs
 * @param inputCommand
 * @param client
 * @param chatId
 * @return {Promise<void>}
 */
async function requestUrl(command, userArgs, inputCommand, client, chatId) {

  try {
    const params = await tgDbService.getParamsByCommandId(command.id);

    // 检查必填参数数量是否足够
    const requiredParams = params.filter(p => p.required === 1);
    if (userArgs.length < requiredParams.length) {
      await client.sendMessage(chatId, {
        message: `⚠️ 参数不足，至少需要 ${requiredParams.length} 个参数`
      });
      return;
    }

    const body = {};
    for (let i = 0; i < params.length; i++) {
      const paramName = params[i].parameter_name;
      const userValue = userArgs[i] || "";
      body[paramName] = userValue;
    }

    let response;
    if (command.method.toUpperCase() === "GET") {
      response = await axios.get(command.url, { params: body });
    } else {
      response = await axios.post(command.url, body);
    }


    if (response.data.code !== 200){
      console.warn(`[WARN]接口返回code非200:`,response.data);
      return
    }

    const resText = JSON.stringify(response.data, null, 2);
    await client.sendMessage(chatId, {
      message: `✅ 请求成功:\n${resText}`
    });

  } catch (e) {
    console.error(`[ERROR] 机器人调用接口失败:`, e);
    await client.sendMessage(chatId, {
      message: `❌ 请求失败：${e?.response?.data?.message || e.message}`
    });
  }
}

async function getErsanToken(redis) {
  try {
    const cached = await redis.get(ERSAN_TOKEN_KEY);
    console.log(`getErsanToken cached = ${cached}`)
    if (cached) {
      try {
        const { token, exp } = JSON.parse(cached);
        if (token && typeof exp === "number" && Date.now() < exp) {
          return token;
        }
      } catch {}
    }
    //https://api.pay.ersan.click/admin-api/system/auth/login测试环境
    const loginUrl = "https://api.gamecloud.vip/admin-api/system/auth/login";
    //const loginUrl = "https://api.pay.ersan.click/admin-api/system/auth/login";
    const loginBody = { type: 0, username: "robot", password: "Apple_Rob@op*" };
    //const loginBody = { type: 0, username: "robot", password: "robot132456" };

    const resp = await axios.post(loginUrl, loginBody);
    console.log(`getErsanToken 中 respond 返回的code = ${resp.data.code}，data = ${resp.data}`)
    if (!resp?.data || resp.data.code !== 0 || !resp.data.data) {
      throw new Error(`登录接口返回异常：${JSON.stringify(resp?.data)}`);
    }

    const { accessToken, expiresTime } = resp.data.data;
    if (!accessToken || !expiresTime) {
      throw new Error("登录响应缺少 accessToken 或 expiresTime");
    }

    const now = Date.now();
    const tenMin = 10 * 60 * 1000;
    const safeExpireTs = Math.max(now + 60 * 1000, expiresTime - tenMin);
    const ttlSec = Math.max(60, Math.floor((safeExpireTs - now) / 1000));

    await redis.set(ERSAN_TOKEN_KEY, JSON.stringify({ token: accessToken, exp: safeExpireTs }), "EX", ttlSec);
    return accessToken;
  }catch (err){
    console.error(`getErsanToken:${err}`)
    return null
  }
}

module.exports = {
  requestUrl,
  getErsanToken
};
