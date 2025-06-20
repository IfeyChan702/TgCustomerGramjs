const express = require('express');
const { startRedis } = require('./models/redisModel');
const loginRoutes = require('./routes/loginRoutes');
const tgRoutes = require('./routes/tgRoutes');
const replyRoutes = require('./routes/tgreplyRoutes');
const merchantRoutes = require('./routes/tgMerchantRoute');
const accountRoutes = require('./routes/tgAccountRoute');
const channelRoutes = require('./routes/tgChannelRoute');
require('./models/mysqlModel');


const app = express();
app.use(express.json());

// 启动 Redis
startRedis();

// 注册路由
app.use('/api', loginRoutes);
app.use('/api/tg', tgRoutes);
app.use('/api', replyRoutes);
app.use('/api', merchantRoutes);
app.use('/api', accountRoutes);
app.use('/api', channelRoutes);

module.exports = app;


