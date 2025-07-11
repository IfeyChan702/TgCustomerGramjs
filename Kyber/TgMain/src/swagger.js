const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '项目 API 文档',
      version: '1.0.0',
      description: '基于 Express + gramjs 的 API 文档'
    },
    servers: [
      {
        url: 'http://localhost:8087/api', // 你的API前缀
      }
    ]
  },

  apis: ['./src/routes/tgRoutes.js',
    './src/routes/ExportRoutes.js',
    './src/routes/loginRoutes.js',
    './src/routes/projectRoutes.js',
    './src/routes/tgAccountRoute.js',
    './src/routes/tgChannelRoute.js',
    './src/routes/tgMerchantRoute.js',
    './src/routes/tgOrderRoute.js',
    './src/routes/tgReplyRoute.js'], // 支持多文件, 记得调整路径
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerUi, swaggerSpec };
