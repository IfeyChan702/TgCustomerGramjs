// redisTest.js
const { createClient } = require('redis');

// 远程 Redis 地址和密码（请换成你的真实配置）
const redisUrl = 'redis://:test123456@192.168.3.77:44513'; // 有密码加:yourpassword@，无密码去掉

const client = createClient({ url: redisUrl });

client.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
  await client.connect();

  // 写入
  await client.hSet('tg:account:85252021856', {
    apiId: '22059335',
    apiHash: '5eb343d4aa291469585740ecccba1852',
    session: '1BQANOTEuMTA4LjU2LjEzNQG7EcK93JrCh3YiNpWU75i5j/ZgfeEq0vk3gIitRN9QD4Sd9idfgHCrpzL5drPDODvOdOb7Y4fFyEFqlgP4ICMVpaGJEUIzEUbf+KuevDkP4MNweeaCTLM00o5H7dJ4Sq7eB0JWiRxFApARUrgoGcI8EG4ClQQfJodoYDKi2Fchub8pMKJvKeaV9XEOj7EwYKvbBHWOD2QA/HGvHGZ0hxFXKc3U/2tQAb83ZI3Lc68G2lET+02MBi+9aDGWXgbwE9P5j62sw0l00ry9uTIXHz1/ePYGSwa+a/Qd+qx6U2I3Ok/oXtfwnVrIISnLcd2OHJuVe+k3IW4/lTKtNn+ZrHf9fQ=='
  });
  // 读取
  const value = await client.hGetAll('tg:account:85252021856');
  console.log(value);

  await client.quit();
})();
