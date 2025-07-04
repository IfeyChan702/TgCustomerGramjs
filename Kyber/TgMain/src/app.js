const express = require('express');
const { startRedis } = require('./models/redisModel');
const loginRoutes = require('./routes/loginRoutes');
const exportRoutes = require('./routes/ExportRoutes');
const tgRoutes = require('./routes/tgRoutes');
const replyRoutes = require('./routes/tgReplyRoutes');
const merchantRoutes = require('./routes/tgMerchantRoute');
const accountRoutes = require('./routes/tgAccountRoute');
const channelRoutes = require('./routes/tgChannelRoute');
const orderRoutes = require('./routes/tgOrderRoutes');
require('./models/mysqlModel');


const app = express();
app.use(express.json());

// 启动 Redis
startRedis();

// 注册路由
app.use('/api', loginRoutes);
app.use('/api', exportRoutes);
app.use('/api/tg', tgRoutes);
app.use('/api', replyRoutes);
app.use('/api', merchantRoutes);
app.use('/api', accountRoutes);
app.use('/api', channelRoutes);
app.use('/api', orderRoutes);

module.exports = app;


