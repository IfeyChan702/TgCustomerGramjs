// handle/handleSuccess.js
const axios = require('axios');

const TARGET_MID = 'M658177203199046120'; // 固定只统计这个商户
const API_URL = 'https://bi.humideah.com/bi/sys/stats/merchant';

const API_HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8,en-US;q=0.7,zh-TW;q=0.6',
  'cache-control': 'no-cache',
  'origin': 'https://manager.humideah.com',
  'pragma': 'no-cache',
  'priority': 'u=1, i',
  'referer': 'https://manager.humideah.com/',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  // 如果需要鉴权：在这里追加 Cookie 或 Authorization
};

async function fetchMerchantStats() {
  const res = await axios.get(API_URL, { headers: API_HEADERS });
  return res.data;
}

function clampRate(n) {
  n = Number(n) || 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function formatPct(n) {
  return `${(Number(n) || 0).toFixed(2)}%`;
}

function buildTextReport(json, mid) {
  let labels  = json?.data?.merchantStatisticX || [];
  const triple  = json?.data?.merchantStatistic?.[mid];
  const nameMap = Object.fromEntries((json?.data?.merchantOption || []).map(([id, n]) => [id, n]));
  const title   = nameMap[mid] || mid;

  if (!Array.isArray(triple) || triple.length < 3) {
    throw new Error(`商户 ${mid} 数据结构不完整`);
  }
  let orders  = Array.isArray(triple[0]) ? triple[0] : [];
  let success = Array.isArray(triple[1]) ? triple[1] : [];
  let rateArr = Array.isArray(triple[2]) ? triple[2] : [];

  const len = Math.min(labels.length, orders.length, success.length, rateArr.length);
  labels  = labels.slice(-len);
  orders  = orders.slice(-len);
  success = success.slice(-len);
  rateArr = rateArr.slice(-len);

  const lines = [];
  lines.push(`📈 ${title}（过去 ${len} 分钟代收）`);
  lines.push('');

  for (let i = 0; i < len; i++) {
    const t   = labels[i];
    const o   = Number(orders[i])  || 0;
    const s   = Number(success[i]) || 0;
    const r   = clampRate(rateArr[i]);
    lines.push(`${t}  订单:${o}  成功:${s}`);
    lines.push(`成功率:${formatPct(r)}`);
  }

  const totalOrders  = orders.reduce((a, b) => a + (Number(b) || 0), 0);
  const totalSuccess = success.reduce((a, b) => a + (Number(b) || 0), 0);
  const avgRate      = rateArr.reduce((a, b) => a + (Number(b) || 0), 0) / (len || 1);

  lines.push('');
  lines.push('——— 汇总数据 ———');
  lines.push(`总订单: ${totalOrders}`);
  lines.push(`总成功: ${totalSuccess}`);
  lines.push(`平均成功率: ${formatPct(avgRate)}`);

  return lines.join('\n');
}

async function requestUrl(client, chatId) {
  try {
    const json = await fetchMerchantStats();
    const text = buildTextReport(json, TARGET_MID);
    await client.sendMessage(chatId, { message: text });
  } catch (err) {
    console.error('[handleSuccess text report] failed:', err);
    await client.sendMessage(chatId, { message: `❌ 生成失败：${err.message || err}` });
  }
}

module.exports = { requestUrl };
