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
NODE_ENV: "prod",
// 其他GramJS需要的环境变量 production development
}
}]
}
