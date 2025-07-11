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

/**
 * 增加parameter数据
 */
router.post("/tg/parameter", async (req, res) => {
  const { commandListId, parameterName, parameterValue, required } = req.body;

  if (!commandListId || isNaN(parseInt(commandListId))) {
    return res.json(fail("commandListId 不能为空且必须为数字"));
  }
  if (!parameterName || parameterName.trim() === "") {
    return res.json(fail("parameterName 不能为空"));
  }

  const cmdId = parseInt(commandListId);
  const finalName = parameterName.trim();
  const finalValue = parameterValue ? parameterValue.toString().trim() : "";
  const isRequired = required === true || required === "true" ? 1 : 0;

  try {
    const result = await tgParameterListService.insertParameter(cmdId, finalName, finalValue, isRequired);

    if (result.affectedRows === 1) {
      return res.json(success("参数新增成功"));
    } else {
      return res.json(fail("参数新增失败"));
    }

  } catch (err) {
    console.error("[ERROR] 新增参数失败:", err);
    return res.json(fail("系统繁忙，新增失败"));
  }
});

/**
 * 修改数据
 */
router.put("/tg/parameter", async (req, res) => {
  const { id, parameterName, parameterValue, required } = req.body;

  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id 不能为空且必须为数字"));
  }

  const paramId = parseInt(id);
  const hasName = typeof parameterName === "string" && parameterName.trim() !== "";
  const hasValue = parameterValue !== undefined && parameterValue !== null;
  const hasRequired = required !== undefined;

  if (!hasName && !hasValue && !hasRequired) {
    return res.json(fail("parameterName、parameterValue、required 至少传一个"));
  }

  try {
    const origin = await tgParameterListService.queryParameterById(paramId);
    if (!origin) {
      return res.json(fail("该参数 ID 不存在"));
    }

    const finalName = hasName ? parameterName.trim() : origin.parameter_name;
    const finalValue = hasValue ? parameterValue.toString().trim() : origin.parameter_value;
    const finalRequired = hasRequired ? (required === true || required === "true" ? 1 : 0) : origin.required;

    const noChange =
      finalName === origin.parameter_name &&
      finalValue === origin.parameter_value &&
      finalRequired === origin.required;

    if (noChange) {
      return res.json(fail("参数未发生变化，无需修改"));
    }

    const result = await tgParameterListService.updateParameterById(paramId, finalName, finalValue, finalRequired);

    if (result.affectedRows === 1) {
      return res.json(success("修改成功"));
    } else {
      return res.json(fail("修改失败"));
    }
  } catch (err) {
    console.error(`[ERROR] 修改参数失败:`, err);
    res.json(fail("系统繁忙，修改失败"));
  }
});

/**
 * 根据id删除数据
 */
router.delete("/tg/parameter/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id 不能为空且必须为数字"));
  }

  const paramId = parseInt(id);

  try {
    const exist = await tgParameterListService.queryParameterById(paramId);
    if (!exist) {
      return res.json(fail("该参数不存在"));
    }

    const result = await tgParameterListService.deleteParameterById(paramId);
    if (result.affectedRows === 1) {
      return res.json(success("删除成功"));
    } else {
      return res.json(fail("删除失败"));
    }
  } catch (err) {
    console.error("[ERROR] 删除参数失败:", err);
    res.json(fail("系统繁忙，删除失败"));
  }
});

module.exports = router;
