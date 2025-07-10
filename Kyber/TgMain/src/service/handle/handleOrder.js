
/*
export async function requestUrl(messageText, client, chatId) {
  try {
    const commandRegex = /^\/request\s+(\w+)\s+(.*?)\s+(https?:\/\/\S+)$/;
    const match = messageText.match(commandRegex);
    if (!match) {
      await client.sendMessage(chatId, {
        message: "❌ 命令格式错误！请使用格式：/request POST JSON URL"
      });
      return;
    }
    const reqMethod = match[1].toUpperCase();
    const rawJson = match[2];
    const url = match[3];

    let data = {};
    try {
      data = JSON.parse(rawJson);
    } catch (err) {
      await client.sendMessage(chatId, {
        message: `❌ 参数 JSON 解析失败，请检查格式是否正确：${err.message}`
      });
      return;
    }

    const res = await axios({
      method: reqMethod,
      url,
      data: ["POST", "PUT", "PATCH"].includes(reqMethod) ? data : undefined,
      params: reqMethod === "GET" ? data : undefined
    });

    await client.sendMessage(chatId, {
      message: `✅ 接口调用成功，返回：\n\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``
    });
  } catch (err) {
    console.error(`[requestUrl Error]`, err);
    await client.sendMessage(chatId, {
      message: `❌ 请求失败：${err.message}`
    });
  }
}

module.exports = {
  requestUrl
};*/
