const express = require("express");
const router = express.Router();
const { success, fail } = require("../../utils/responseWrapper");
const tgBotService = require("../../service/system/bot/tgBotService");
const { encryptToken } = require("../../utils/encryptTokenUtil");

router.post("/bot/create", async (req, res) => {
  const { name, username, token, env = "dev" } = req.body;

  if (!name || name.trim() === "") {
    return res.json(fail("name为空，name是必须传的参数"));
  }
  if (!username || username.trim() === "") {
    return res.json(fail("username为空，username是必须传的参数"));
  }
  if (!token || token.trim() === "") {
    return res.json(fail("token为空，token是必须传的参数"));
  }

  const finalName = name.trim();
  const finalUsername = username.trim();
  const finalToken = token.trim();
  const finalEnv = env.trim();

  if (!finalToken.includes(":")) {
    return res.json(fail("token格式错误，必须包含 ':'"));
  }

  try {
    const encryptedToken = encryptToken(finalToken);
    const result = await tgBotService.insert(finalName, finalUsername, encryptedToken, finalEnv, 1);
    let message = "Bot 更新成功";
    if (result.insertId > 0) {
      message = "Bot 创建成功";
    }
    //todo 需要触发热更新
    return res.json(success(message));
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.json(fail("数据库已存在该 username，无需重复添加"));
    }

    console.error(`[ERROR tgBotRoutes] 保存 Bot Token 失败 @${finalUsername}:`, e);
    return res.json(fail("系统繁忙，保存失败"));
  }
});


module.exports = router;
