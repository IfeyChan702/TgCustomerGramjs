
async function getOrRunMessageResponse(redis,chatId,messageId,ttlSeconds=600,fn){
  const resultKey = `msg:result:${chatId}:${messageId}`;
  const lockKey = `msg:lok:${chatId}:${messageId}`

  const cached = await redis.get(resultKey);
  if (cached){
    return false;
  }

  const lock = await redis.set(lockKey,"1","NX","EX",15);
  if (!lock){
    return false;
  }

  let result='';
  try {
    await fn();
    await redis.set(resultKey,"1","EX",ttlSeconds);
    return  true;
  }catch (e){
    console.error("[handle error]",e);
    return  false;
  }

}


module.exports = { getOrRunMessageResponse }
