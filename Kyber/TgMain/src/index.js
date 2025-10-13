const path = require('path');
const dotenv = require('dotenv');

// 设置 .env 文件路径（从 src 向上一级找）
const env = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, `../.env.${env}`);
dotenv.config({ path: envPath });

const app = require('./app');

const { bot, startBot } = require("./service/system/bot");
const createWithdrawalsRouter = require("./routes/system/withdrawalsRoutes");
const PORT = 8087;

app.use(express.json());
app.use("/api", createWithdrawalsRouter(bot));
app.listen(PORT, () => {
  console.log(`后端服务已启动：http://localhost:${PORT}`);
});

startBot().catch((err) => {
  console.error("❌ Bot 启动失败:", err);
});
