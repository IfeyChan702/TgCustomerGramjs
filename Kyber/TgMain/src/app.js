const express = require("express");
const { startRedis } = require("./models/redisModel");
const loginRoutes = require("./routes/loginRoutes");
const exportRoutes = require("./routes/ExportRoutes");
const tgRoutes = require("./routes/tgRoutes");
const replyRoutes = require("./routes/tgReplyRoutes");
const merchantRoutes = require("./routes/tgMerchantRoute");
const accountRoutes = require("./routes/tgAccountRoute");
const channelRoutes = require("./routes/tgChannelRoute");
const orderRoutes = require("./routes/tgOrderRoutes");
const projectRoutes = require("./routes/project/projectRoutes");
const tgCommandListRoutes = require("./routes/tgCommandListRoutes");
const tgParameterListRoutes = require("./routes/tgParameterListRoutes");
const projectDataRoutes = require("./routes/project/projectDataRoutes");
require("./models/mysqlModel");
const session = require("express-session");

const app = express();
app.use(express.json());

// 启动 Redis
startRedis();

// 注册路由
app.use(session({
  secret: "my-captcha-secret", // 可以自定义
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 5 * 60 * 1000 } // 5分钟有效
}));
app.use("/api", loginRoutes);
app.use("/api", exportRoutes);
app.use("/api/tg", tgRoutes);
app.use("/api", replyRoutes);
app.use("/api", merchantRoutes);
app.use("/api", accountRoutes);
app.use("/api", channelRoutes);
app.use("/api", orderRoutes);
app.use("/api", projectRoutes, tgCommandListRoutes, tgParameterListRoutes, projectDataRoutes);


module.exports = app;


