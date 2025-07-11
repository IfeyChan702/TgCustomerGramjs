const express = require("express");
const router = express.Router();
const tgCommandListService = require("../../service/command/tgCommandListService");
const { success, fail } = require("../../utils/responseWrapper");

/**
 * 模糊查询，分页查询，条件查询command
 */
router.get("/tg/command", async (req, res) => {
  const {
    method = null,
    identifier = null,
    keyword = '',
    page = 1,
    size = 10
  } = req.query;

  const params = {
    method,
    identifier,
    keyword,
    page: parseInt(page),
    size: parseInt(size)
  };

  try {
    const result = await tgCommandListService.getPageCommands(params);
    res.json(success(result))
  }catch (err){
    console.error(`[ERROR] 查询tg_command_list失败:`,err);
    res.json(fail(`操作故障，查询失败`))
  }
})

module.exports = router;
