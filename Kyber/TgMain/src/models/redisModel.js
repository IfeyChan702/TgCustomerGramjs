const { createClient } = require("redis");
const redis = createClient({
  url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});
// redis.connect();
redis.on('error', (err) => console.error('Redis Client Error', err));

async function startRedis() {
  await redis.connect();
  console.log('Connected to Redis');
}


// Export functions for usage in controllers/services
module.exports = {redis,startRedis};
