const fetch = require('node-fetch');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// 只取这两组
const TARGET_MIDS = [
  'M658177203199046120'
];

const API_URL = 'https://bi.humideah.com/bi/sys/stats/merchant';

// 按你给的 header（服务端 fetch 不受 CORS 限制，但保留 UA/Referer 等以防后端校验）
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
};

function nameMap(merchantOption) {
  const m = {};
  merchantOption.forEach(([id, name]) => (m[id] = name));
  return m;
}

async function fetchMerchantStats() {
  const res = await fetch(API_URL, { headers: API_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 画「订单数、成功数（柱）」+「成功率（折线）」双轴图
async function renderComboChart({ labels, orders, success, rate, title }) {
  const width = 1200, height = 620;
  const canvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });

  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'bar', label: '订单笔数', data: orders, yAxisID: 'y', borderWidth: 1 },
        { type: 'bar', label: '成功笔数', data: success, yAxisID: 'y', borderWidth: 1 },
        { type: 'line', label: '成功率', data: rate, yAxisID: 'y1', tension: 0.3, pointRadius: 3 }
      ]
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: title },
        legend: { display: true }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: '笔数' }, grid: { drawOnChartArea: true } },
        y1: {
          beginAtZero: true, max: 100, position: 'right',
          title: { display: true, text: '成功率 %' },
          ticks: { callback: v => `${v} %` },
          grid: { drawOnChartArea: false }
        }
      },
      interaction: { mode: 'index', intersect: false }
    }
  };

  return canvas.renderToBuffer(cfg, 'image/png'); // === Buffer（直接用于 sendFile）
}

// 将接口数据抽出成画图需要的三条序列
function pickSeriesForMid(apiData, mid) {
  const labels = apiData.data.merchantStatisticX;                // ['14:47', ...] 最近十分钟
  const triple = apiData.data.merchantStatistic[mid];            // [orders[], success[], rate[]]
  if (!triple || triple.length < 3) throw new Error(`商户 ${mid} 数据结构不完整`);
  const orders  = triple[0] || [];
  const success = triple[1] || [];
  const rate    = triple[2] || []; // 已是 0~100
  return { labels, orders, success, rate };
}

// ===== 在你的消息处理里加一个命令：/successrate =====
async function handleSuccessRateCommand(client, chatId) {
  // 提示中间态
  await client.sendMessage(chatId, { message: '⏳ 统计中，正在生成图表…' });

  const json = await fetchMerchantStats();
  const names = nameMap(json.data.merchantOption);

  for (const mid of TARGET_MIDS) {
    const { labels, orders, success, rate } = pickSeriesForMid(json, mid);
    const title = `${names[mid] || mid} ｜ ${labels[0]} ~ ${labels[labels.length - 1]}`;
    const png = await renderComboChart({ labels, orders, success, rate, title });

    // Buffer 直接上传 + 发送
    const uploaded = await client.uploadFile({ file: { buffer: png, name: `${mid}.png` } });
    await client.sendFile(chatId, { file: uploaded, caption: `📊 ${names[mid] || mid}` });
  }
}
