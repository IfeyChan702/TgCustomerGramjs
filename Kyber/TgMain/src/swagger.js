// swagger.js
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: '项目 API 文档', version: '1.0.0', description: 'Express + gramjs' },
    servers: [{ url: 'http://localhost:8087' }], // 注意：不要把 '/api' 硬编码进来，除非你所有路由都带 /api 前缀
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    // 如果你希望“默认都需要JWT”，保留这行；否则删掉，改在具体接口注释里加 @security
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, './routes/**/*.js'),      // 推荐用绝对路径
    path.join(__dirname, './controllers/**/*.js'), // 如果控制器里也写了注释
  ],
};

const swaggerSpec = swaggerJSDoc(options);

// 可选：启动时做个健壮性检查
if (!swaggerSpec || !swaggerSpec.openapi) {
  console.error('❌ swaggerSpec 生成失败，检查 apis 路径是否正确');
}

module.exports = { swaggerUi, swaggerSpec };
