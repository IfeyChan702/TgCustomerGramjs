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

    if (!projectId || projectId === ""){
      return res.json(fail("projectId不能为空"))
    }
    const proId = parseInt(projectId)
    const offset = parseInt(size) * parseInt(page);
    const limit = parseInt(size);

    const projectList = await projectDataService.queryPageData(offset,limit,proId,key);
    const countResult = await projectDataService.queryCountData(projectId,key)
    const total = countResult[0]?.total || 0;

    res.json({
      projectList,
      total,
      page: parseInt(page),
      size: limit
    })

  } catch (e) {
    console.error(`[ERROR] 查询项目列表失败:`, e);
    res.json(fail("系统繁忙，查询projectData失败"));
  }
});
module.exports = router;
