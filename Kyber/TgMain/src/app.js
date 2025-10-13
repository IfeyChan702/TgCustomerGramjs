// src/app.js
require('dotenv').config();                      // 1. 先加载 .env

const express = require('express');
const session = require('express-session');
const { startRedis } = require('./models/redisModel');
require('./models/mysqlModel');                  // 2. 初始化 DB（确保 .env 已加载）

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

// Swagger
const { swaggerUi, swaggerSpec } = require('./swagger');

// JWT 守卫
const { verifyToken } = require('../src/middleware/auth'); // 你发的中间件

const app = express();
app.use(express.json());

// 3) Redis / Session
startRedis();
app.use(
  session({
    secret: 'my-captcha-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 5 * 60 * 1000 },
  })
);

// 4) 先挂 Swagger（在任何鉴权之前，且 swaggerSpec 不能为空）
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs/swagger.json', (_req, res) => {
  res.type('application/json').send(swaggerSpec);
});

// 5) 开放路由（不需要 JWT）
app.use('/api', loginRoutes); // /api/login/account、/api/captcha、/api/refresh 等

// 6) 从这里开始拦截业务路由，放行白名单
app.use('/api', (req, res, next) => {
  // 白名单前缀（按你的路由实际情况增减）
  const openPrefixes = [
    '/login',          // /api/login/*
    '/captcha',        // /api/captcha
    '/refresh',        // /api/refresh
    '/login/outLogin', // /api/login/outLogin
  ];
  if (openPrefixes.some((p) => req.path.startsWith(p))) return next();
  return verifyToken(req, res, next); // 其余都要带 Bearer
});

// 7) 受保护的业务路由（顺序随意，但都在守卫之后）
app.use('/api', exportRoutes);
app.use('/api/tg', tgRoutes);
app.use('/api', replyRoutes);
app.use('/api', merchantRoutes);
app.use('/api', accountRoutes);
app.use('/api', channelRoutes);
app.use('/api', orderRoutes);
app.use('/api', projectDataRoutes, projectRoutes);
app.use('/api', tgCommandListRoutes, tgParameterListRoutes, tgComGroPeRoutes);

// 8) 兜底错误
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Server Error' });
});

module.exports = app;
