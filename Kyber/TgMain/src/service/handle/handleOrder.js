const tgDbService = require("../tgDbService");
const axios = require("axios");
/**
 * 处理命令型的请求
 * @param inputCommand
 * @param client
 * @param chatId
 * @return {Promise<void>}
 */
async function requestUrl(inputCommand, client, chatId) {

  try {
    const parts = inputCommand.trim().split(/\s+/);
    const identifier = parts[0].replace("/", "");
    const userArgs = parts.slice(1);

    const commandList = await tgDbService.getCommandByIdentifier(identifier);
    const command = commandList[0];
    if (!command) {
      await client.sendMessage(chatId, { message: `❌ 未知命令：/${identifier}` });
      return;
    }

    const params = await tgDbService.getParamsByCommandId(command.id);

    // 检查必填参数数量是否足够
    const requiredParams = params.filter(p => p.required === 1);
    if (userArgs.length < requiredParams.length) {
      await client.sendMessage(chatId, {
        message: `⚠️ 参数不足，至少需要 ${requiredParams.length} 个参数`
      });
      return;
    }

    const body = {};
    for (let i = 0; i < params.length; i++) {
      const paramName = params[i].parameter_name;
      const userValue = userArgs[i] || "";
      body[paramName] = userValue;
    }

    let response;
    if (command.method.toUpperCase() === "GET") {
      response = await axios.get(command.url, { params: body });
    } else {
      response = await axios.post(command.url, body);
    }

    const resText = JSON.stringify(response.data, null, 2);
    await client.sendMessage(chatId, {
      message: `✅ 请求成功:\n${resText}`
    });

  } catch (e) {
    console.error(`[ERROR] 机器人调用接口失败:`, e);
    await client.sendMessage(chatId, {
      message: `❌ 请求失败：${e?.response?.data?.message || e.message}`
    });
  }
}

module.exports = {
  requestUrl
};
