
async function withRedisLock(redis,key,ttlSeconds,fn){
  const value = `${Date.now()}-${Math.random()}`;
  const lock = await redis.set(key,value,"NX","EX",ttlSeconds);

  if (!lock) return;

  try {
    await fn();
    return true;
  }finally {
    const currentValue =await redis.get(key);
    if (currentValue === value){
      await redis.del(key);
    }
  }
}


module.exports = { withRedisLock }
