const express = require("express");
const router = express.Router();
const { success, fail, fail500, success200 } = require("../../utils/responseWrapper");
const projectDataService = require("../../service/project/projectDataService");
/**
 * 查询project的data数据
 */
router.get("/project/data", async (req, res) => {
  const {
    page = 0,
    size = 10,
    projectId,
    key
  } = req.query;
  try {

    if (!projectId || projectId === "") {
      return res.json(fail("projectId不能为空"));
    }
    const proId = parseInt(projectId);
    const offset = parseInt(size) * parseInt(page);
    const limit = parseInt(size);

    const projectList = await projectDataService.queryPageData(offset, limit, proId, key);
    const countResult = await projectDataService.queryCountData(projectId, key);
    const total = countResult[0]?.total || 0;

    res.json({
      projectList,
      total,
      page: parseInt(page),
      size: limit
    });

  } catch (e) {
    console.error(`[ERROR] 查询项目列表失败:`, e);
    res.json(fail("系统繁忙，查询projectData失败"));
  }
});

/**
 * 查询project的data数据
 */
router.post("/project/data", async (req, res) => {
  const { projectId, key, value } = req.body;

  // 参数校验
  if (!projectId) {
    return res.json(fail("projectId为空，projectId是必须传的参数"));
  }
  const proId = parseInt(projectId);
  if (isNaN(proId)) {
    return res.json(fail("projectId格式错误"));
  }
  if (!key || key.trim() === "") {
    return res.json(fail("key为空，key是必须传的参数"));
  }
  if (!value || value.trim() === "") {
    return res.json(fail("value为空，value是必须传的参数"));
  }

  const finalKey = key.trim();
  const finalValue = value.trim();

  try {
    const result = await projectDataService.queryCountData(proId, finalKey);
    if (result[0].total > 0) {
      return res.json(fail("这个项目的key已经存在"));
    }

    const insertResult = await projectDataService.insertData(proId, finalKey, finalValue);

    if (insertResult.affectedRows === 1) {
      return res.json(success("数据插入成功!"));
    } else {
      return res.json(fail("数据插入失败!"));
    }

  } catch (e) {
    console.error(`[ERROR] 插入projectData失败:`, e);
    res.json(fail("系统繁忙，插入projectData失败"));
  }
});
module.exports = router;
