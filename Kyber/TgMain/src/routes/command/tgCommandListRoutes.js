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
    keyword = "",
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
    res.json(success(result));
  } catch (err) {
    console.error(`[ERROR] 查询tg_command_list失败:`, err);
    res.json(fail(`操作故障，查询失败`));
  }
});
/**
 * 插入
 */
router.post("/tg/command", async (req, res) => {
  const { identifier, url, method, description, allowAll } = req.body;

  if (!identifier || identifier.trim() === "") {
    return res.json(fail("identifier 不能为空"));
  }
  if (!url || url.trim() === "") {
    return res.json(fail("url 不能为空"));
  }
  if (!method || method.trim() === "") {
    return res.json(fail("method 不能为空"));
  }

  const finalIdentifier = identifier.trim();
  const finalUrl = url.trim();
  const finalMethod = method.trim();
  const finalDescription = description ? description.trim() : "";
  const finalAllowAll = allowAll === true || allowAll === 1 || allowAll === "1" || allowAll === "true" ? 1 : 0;


  try {
    const exists = await tgCommandListService.queryCommandByIdentifierAndMethod(finalIdentifier, finalMethod);
    if (exists) {
      return res.json(fail("该 identifier + method 已存在，请勿重复添加"));
    }

    const result = await tgCommandListService.insertCommand({
      identifier: finalIdentifier,
      url: finalUrl,
      method: finalMethod,
      description: finalDescription,
      allowAll: finalAllowAll
    });

    if (result.affectedRows === 1) {
      return res.json(success("新增指令成功！"));
    } else {
      return res.json(fail("新增失败"));
    }
  } catch (err) {
    console.error(`[ERROR] 新增指令失败:`, err);
    res.json(fail("系统繁忙，新增失败"));
  }
});

/**
 * 修改的代码
 */
router.put("/tg/command/:id", async (req, res) => {
  const { id } = req.params;
  const { identifier, url, method, description, allowAll } = req.body;

  // 参数校验
  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id 不能为空且必须为数字"));
  }

  if (!identifier || identifier.trim() === "") {
    return res.json(fail("identifier 不能为空"));
  }

  if (!url || url.trim() === "") {
    return res.json(fail("url 不能为空"));
  }

  if (!method || method.trim() === "") {
    return res.json(fail("method 不能为空"));
  }

  const commandId = parseInt(id);
  const finalIdentifier = identifier.trim();
  const finalUrl = url.trim();
  const finalMethod = method.trim();
  const finalDesc = description ? description.trim() : "";
  const finalAllowAll = allowAll === 1 || allowAll === "1" || allowAll === true ? 1 : 0;

  try {
    const origin = await tgCommandListService.queryCommandById(commandId);
    if (!origin) {
      return res.json(fail("该 ID 对应的数据不存在"));
    }

    const existing = await tgCommandListService.queryByIdentifier(finalIdentifier);
    if (existing && existing.id !== commandId) {
      return res.json(fail("该 identifier 已存在，不能重复"));
    }

    const isUnchanged =
      finalIdentifier === origin.identifier &&
      finalUrl === origin.url &&
      finalMethod === origin.method &&
      finalDesc === (origin.description || "") &&
      finalAllowAll === (origin.allow_all || 0);

    if (isUnchanged) {
      return res.json(fail("内容未发生变化，无需修改"));
    }

    const result = await tgCommandListService.updateCommandById(
      commandId,
      finalIdentifier,
      finalUrl,
      finalMethod,
      finalDesc,
      finalAllowAll
    );

    if (result.affectedRows === 1) {
      return res.json(success("修改成功"));
    } else {
      return res.json(fail("修改失败"));
    }

  } catch (err) {
    console.error(`[ERROR] 修改 tg_command_list 失败:`, err);
    res.json(fail("系统繁忙，修改失败"));
  }
});
/**
 * 删除
 */
router.delete("/tg/command/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id 不能为空且必须为数字"));
  }

  const commandId = parseInt(id);

  try {
    const origin = await tgCommandListService.queryCommandById(commandId);
    if (!origin) {
      return res.json(fail("该指令不存在，无法删除"));
    }

    const result = await tgCommandListService.deleteCommandById(commandId);
    if (result.affectedRows === 1) {
      return res.json(success("删除成功"));
    } else {
      return res.json(fail("删除失败"));
    }

  } catch (err) {
    console.error(`[ERROR] 删除 tg_command_list 失败:`, err);
    res.json(fail("系统繁忙，删除失败"));
  }
});

module.exports = router;
