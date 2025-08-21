nvm install v22.11.0 
nvm use 22.11.0

git clone https://github.com/IfeyChan702/TgCustomerGramjs.git
## 项目放在这个文件下面
/opt/ifey/tg-node-service
pm2 start app.js --name "your-app-name"

#!/bin/bash
cd /opt/ifey/tg-node-service || exit
git pull origin main
npm install
pm2 restart your-app




gramjs.config.js

module.exports = {
apps: [{
name: "gramjs-bot",
script: "/opt/ifey/tg-node-service/TgCustomerGramjs/Kyber/TgMain/src/index.js",
interpreter: "node",
instances: 1,
autorestart: true,
watch: false,
max_memory_restart: "1G",
env: {
NODE_ENV: "development",
// 其他GramJS需要的环境变量
}
}]
}

pm2 start /opt/ifey/tg-node-service/gramjs.config.js

完整设置开机自启流程
pm2 save
pm2 startup


pm2 logs gramjs-bot

pm2 start index.js --name "gramjs-bot"

pm2 stop gramjs-bot

pm2 restart gramjs-bot


实时日志:
pm2 logs gramjs-bot --lines 100 --timestamp

清空日志:
pm2 flush gramjs-bot

保存当前PM2配置:
pm2 save

设置开机自启:
pm2 startup
# 然后按照提示执行生成的命令
pm2 save
