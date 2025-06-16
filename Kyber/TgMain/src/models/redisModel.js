const { createClient } = require("redis");
const redis = createClient({
  url: 'redis://:test123456@192.168.3.77:44513',
});
// redis.connect();
redis.on('error', (err) => console.error('Redis Client Error', err));

async function startRedis() {
  await redis.connect();
  console.log('Connected to Redis');
}


// Export functions for usage in controllers/services
module.exports = {redis,startRedis};