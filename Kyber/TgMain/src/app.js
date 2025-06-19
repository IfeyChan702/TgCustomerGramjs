const express = require('express');
const { startRedis } = require('./models/redisModel');
const loginRoutes = require('./routes/loginRoutes');
const tgRoutes = require('./routes/tgRoutes');
const replyRoutes = require('./routes/tgreplyRoutes');
require('./models/mysqlModel');

const app = express();
app.use(express.json());

// // 启动 Redis
// startRedis();

// 注册路由
app.use('/api', loginRoutes);
app.use('/api/tg', tgRoutes);
app.use('/api', replyRoutes);

module.exports = app;


