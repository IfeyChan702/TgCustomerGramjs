
// botConfig.js
require("dotenv").config({ path: ".env.development" });

module.exports = {
  // Telegram bot token
  botToken: process.env.CUSTOMER_BOT_TOKEN,

  alarmBotToken: process.env.ALARM_BOT_TOKEN,

  // 如果你还需要用 telegram API_ID / API_HASH（tdlib 或 gramjs 才会用到）
  apiId: process.env.API_ID ? Number(process.env.API_ID) : undefined,
  apiHash: process.env.API_HASH,

  // 审核回调相关配置
  backendBase: process.env.BACKEND_BASE || "",   // 后端 API 根地址
  backendToken: process.env.BACKEND_TOKEN || "", // 后端 API 鉴权 token

  // 安全签名密钥（用来生成 callback_data 的签名）
  hmacKey: process.env.HMAC_KEY || "super-secret",

  // 本地 HTTP 服务端口（用于 /create_card）
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
};
