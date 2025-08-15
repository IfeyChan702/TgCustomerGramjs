const express = require("express");
const router = express.Router();
const tgComGroPeService = require("../../service/command/tgComGroPeService");
const { success, fail } = require("../../utils/responseWrapper");
const { finalize } = require("swagger-jsdoc/src/specification");
const { ConfigSet } = require("ts-jest");

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
  const { commandId, groupId, groupName, remark, status } = req.body;

  if (!commandId || isNaN(parseInt(commandId))) {
    return res.json(fail("commandId 不能为空且必须为数字"));
  }

  const finalCommandId = parseInt(commandId);
  const finalStatus =
    status === 1 || status === "1" || status === true ? 1 : 0;

  const finalGroupId =
    groupId !== undefined && groupId !== null && !isNaN(parseInt(groupId))
      ? parseInt(groupId)
      : null;

  const finalGroupName =
    groupName && String(groupName).trim() !== "" ? String(groupName).trim() : null;

  const finalRemark =
    remark && String(remark).trim() !== "" ? String(remark).trim() : null;

  try {
    if (finalGroupId !== null) {
      const rows = await tgComGroPeService.getCommandPerByCommandIdAndGroupId(
        finalCommandId,
        finalGroupId
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return res.json(fail("该 groupId 已在此 commandId 下存在，请勿重复添加"));
      }
    }

    const result = await tgComGroPeService.insertCommandPermissions({
      commandId: finalCommandId,
      groupId: finalGroupId,
      status: finalStatus,
      groupName: finalGroupName,
      remark: finalRemark
    });

    const affected = result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;
    if (affected === 1) {
      return res.json(success("新增成功"));
    }
    return res.json(success("新增完成"));

  } catch (err) {
    console.error(`[ERROR] 新增 tg_command_group_permission 失败:`, err);
    return res.json(fail(err.message || "操作故障，新增失败"));
  }
});

/**
 * 修改的代码
 */
router.put("/tg/command/group/permission/:id", async (req, res) => {

  const { id, groupId, status, groupName, remark } = req.body;

  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id不能为空且必须为数字"));
  }

  try {
    const result = await tgComGroPeService.updateCommandPermission({
      id: parseInt(id),
      groupId,
      status,
      groupName,
      remark
    });

    if (result.affectedRows === 0){
      return res.json(fail("未找到对应记录或者没有修改!"))
    }
    res.json(success("更新成功"));
  } catch (err) {
    console.error(`[ERROR]更新 tg_command_group_permission失败:`,err);
    res.json(fail("操作故障，更新失败"));
  }
});
/**
 * 删除
 */
router.delete("/tg/command/group/permission/:id", async (req, res) => {

});

module.exports = router;
