const express = require("express");
const router = express.Router();
const tgParameterListService = require("../../service/command/tgParameterListService");
const { success, fail } = require("../../utils/responseWrapper");


router.get("/tg/parameter", async (req, res) => {
  const {
    commandListId,
  } = req.query;
  try {

    if (!commandListId){
      return res.json(fail("commandListId不能为空"));
    }

    const id = parseInt(commandListId);
    if (isNaN(id)) {
      return res.json(fail("commandListId 参数必须是数字"));
    }

    const result = await tgParameterListService.getPageParameter(id);
    res.json(success(result))
  }catch (err){
    console.error(`[ERROR] 查询parameter失败:`,err);
    res.json(fail("操作故障,查询失败"))
  }
})
module.exports = router;
