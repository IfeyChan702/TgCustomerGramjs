const { createClient } = require("redis");
const redis = createClient({
  url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});
// redis.connect();
redis.on('error', (err) => console.error('Redis Client Error', err));

let connectingPromise = null;

async function startRedis() {
  if (redis.isOpen) {
    return;
  }
  // 正在连接则复用同一个 promise，避免并发重复 connect
  if (connectingPromise) {
    return connectingPromise;
  }
  connectingPromise = redis.connect()
    .then(() => {
      console.log('[Redis] connected');
      return true;
    })
    .finally(() => {
      connectingPromise = null; // 连接完成后清空
    });

  return connectingPromise;
}


module.exports = {redis,startRedis};
