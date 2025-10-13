const express = require('express');
const session = require('express-session');
const { startRedis } = require('./models/redisModel');
require('./models/mysqlModel'); // 1. 初始化 DB（确保 .env 已加载）

// 路由
const loginRoutes = require('./routes/loginRoutes');
const exportRoutes = require('./routes/ExportRoutes');
const tgRoutes = require('./routes/tgRoutes');
const replyRoutes = require('./routes/tgReplyRoutes');
const merchantRoutes = require('./routes/tgMerchantRoute');
const accountRoutes = require('./routes/tgAccountRoute');
const channelRoutes = require('./routes/tgChannelRoute');
const orderRoutes = require('./routes/tgOrderRoutes');
const projectRoutes = require('./routes/project/projectRoutes');
const projectDataRoutes = require('./routes/project/projectDataRoutes');
const tgParameterListRoutes = require('./routes/command/tgParameterListRoutes');
const tgCommandListRoutes = require('./routes/command/tgCommandListRoutes');
const tgComGroPeRoutes = require('./routes/command/tgComGroPeRoutes');
const sysWithdrawals = require('./routes/system/withdrawalsRoutes'); // 🌟 来自第二个文件的新路由

require("./models/mysqlModel");
const { swaggerUi, swaggerSpec } = require("./swagger");

// JWT 守卫
const { verifyToken } = require('../src/middleware/auth');

// 启动服务 (Bot 服务初始化，来自第二个文件)
const { bot } = require('./service/system/bot');

const app = express();
app.use(express.json());

// 2) Redis / Session 初始化
startRedis();
// bot 模块的 require 已经包含在上方，如果需要显式启动，请在这里添加 bot()
app.use(
  session({
    secret: 'my-captcha-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 5 * 60 * 1000 },
  })
);

// 3) Swagger Setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs/swagger.json', (_req, res) => {
  res.type('application/json').send(swaggerSpec);
});

// 4) 开放路由（无需 JWT 守卫，包含 /login/account, /captcha, /login/outLogin 等）
// 我们在这里先挂载 loginRoutes，以便在守卫中只检查需要放行的路径。
app.use('/api', loginRoutes);

// 5) JWT 认证守卫：拦截所有 /api 请求，放行白名单
app.use('/api', (req, res, next) => {

  // 必须是完全公开的路径
  const publicPaths = [
    '/login/account',
    '/captcha',
    '/login/outLogin'
  ];

  // 检查请求路径是否是白名单中的公开路径
  if (publicPaths.some((p) => req.path.startsWith(p))) {
    return next(); // 放行
  }

  // 其他所有 /api 路径都必须经过 JWT 验证
  return verifyToken(req, res, next);
});

// 6) 受保护的业务路由（都在守卫之后）
app.use('/api', exportRoutes);
app.use('/api/tg', tgRoutes);
app.use('/api', replyRoutes);
app.use('/api', merchantRoutes);
app.use('/api', accountRoutes);
app.use('/api', channelRoutes);
app.use('/api', orderRoutes);
app.use('/api', projectDataRoutes);
app.use('/api', projectRoutes);
app.use('/api', tgCommandListRoutes);
app.use('/api', tgParameterListRoutes);
app.use('/api', tgComGroPeRoutes);
app.use('/api', sysWithdrawals); // 🌟 已加入新路由

// 7) 兜底错误处理
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Server Error' });
});

module.exports = app;
