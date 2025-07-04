const express = require("express");
const router = express.Router();
const { success, fail, fail500, success200 } = require("../utils/responseWrapper");
const projectService = require("../service/projectService");
/**
 * 根据projectId，key获取key和value的接口
 * @param projectId
 * @param key
 */
router.get("/project", async (req, res) => {
  const { projectId, key } = req.query;
  try {
    if (!projectId) {
      return res.json(fail("project_id参数是不可以缺少的"));
    }

    if (!key) {
      return res.json(fail("key参数是不可以缺少的"));
    }

    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return res.json("project_id 应该是数字");
    }
    const data = await projectService.getProject(projectId, key);

    res.json(success(data));
  } catch (err) {
    console.error(`[ERROR] 获取value失败,参数:${projectId},${key}`);
    res.json(fail("系统繁忙，请稍后再试"));
  }
});

/**
 * 获取projectId为1的version和download_url的值
 */
router.get("/project/version/url", async (req, res) => {
  try {
    const data = await projectService.getVerDonByProId(1);
    res.json(success200(data,null));

  } catch (err) {
    console.error(`[ERROR] 获取版本和下载链接失败，projectId: 1`, err);
    res.json(fail500("系统繁忙，请稍后再试"));
  }
});


module.exports = router;
