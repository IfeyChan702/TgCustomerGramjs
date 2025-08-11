const express = require("express");
const router = express.Router();
const tgComGroPeService = require("../../service/command/tgComGroPeService");
const { success, fail } = require("../../utils/responseWrapper");

/**
 * 模糊查询，分页查询，条件查询permission
 */
router.get("/tg/command/group/permission", async (req, res) => {
  const {
    commandId,
    page = 1,
    pageSize = 10,
    keyword = "",
    status
  } = req.query;

  if (!commandId || isNaN(parseInt(commandId))) {
    return res.json(fail("commandId 不能为空且必须为数字"));
  }

  const pageNum = Math.max(parseInt(page), 1);
  const sizeNum = Math.max(parseInt(pageSize), 1);
  const offset = (pageNum - 1) * sizeNum;

  try {
    const result = await tgComGroPeService.getPageCommandPermissions({
      commandId: parseInt(commandId),
      keyword,
      status: status === undefined ? undefined : parseInt(status),
      offset,
      limit: sizeNum
    });
    res.json(success(result));
  } catch (err) {
    console.error(`[ERROR] 查询tg_command_group_permission失败:`, err);
    res.json(fail(`操作故障，查询失败`));
  }
});
/**
 * 插入
 */
router.post("/tg/command/group/permission", async (req, res) => {

});

/**
 * 修改的代码
 */
router.put("/tg/command/group/permission/:id", async (req, res) => {

});
/**
 * 删除
 */
router.delete("/tg/command/group/permission/:id", async (req, res) => {

});

module.exports = router;
