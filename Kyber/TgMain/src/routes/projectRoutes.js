const express = require("express");
const router = express.Router();
const { success, fail, fail500, success200 } = require("../utils/responseWrapper");
const projectService = require("../service/projectService");

/**
 * @swagger
 * /project:
 *   get:
 *     summary: 根据 projectId 和 key 获取 key 和 value
 *     tags:
 *       - Project
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 项目ID
 *       - in: query
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 数据的 key
 *     responses:
 *       200:
 *         description: 成功获取数据
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
 * @swagger
 * /project/version/url:
 *   get:
 *     summary: 获取 projectId=1 的 version 和 download_url
 *     tags:
 *       - Project
 *     responses:
 *       200:
 *         description: 成功返回版本号和下载链接
 */
router.get("/project/version/url", async (req, res) => {
  try {
    const data = await projectService.getVerDonByProId(1);
    res.json(success200(data, null));

  } catch (err) {
    console.error(`[ERROR] 获取版本和下载链接失败，projectId: 1`, err);
    res.json(fail500("系统繁忙，请稍后再试"));
  }
});

/**
 * @swagger
 * /project/data:
 *   get:
 *     summary: 查询项目数据（分页、模糊、条件）
 *     tags:
 *       - Project
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: 项目ID
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键字（模糊查询）
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: 编码
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 当前页码
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页条数
 *     responses:
 *       200:
 *         description: 查询结果
 */
router.get("/project/data", async (req, res) => {
  const {
    projectId = null,
    keyword = null,
    code = null,
    page = 1,
    size = 10
  } = req.query;
  try {
    const params = {
      projectId: projectId ? Number(projectId) : null,
      code,
      keyword,
      page: Number(page),
      size: Number(size)
    };
    const data = await projectService.getProjectData(params);
    res.json(success(data));
  } catch (err) {
    console.error(`[ERROR] 查询项目数据失败:`, err);
    res.json(fail(`后台服务器繁忙，查询数据异常`));
  }
});

/**
 * @swagger
 * /project/data:
 *   post:
 *     summary: 插入项目数据
 *     tags:
 *       - Project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectName:
 *                 type: string
 *               codeTypePre:
 *                 type: string
 *               code:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: 插入成功
 */
router.post("/project/data", async (req, res) => {
  let {
    projectName,
    codeTypePre,
    code,
    value
  } = req.body;
  try {
    if (!projectName || projectName.trim() === "") return res.json(fail("projectName不能为空"));
    if (!code) return res.json(fail("code不能为空"));
    if (!value) return res.json(fail("value不能为空"));


    if (!codeTypePre || typeof codeTypePre !== "string" || codeTypePre.trim() === "") {
      codeTypePre = "project";
    }

    if (codeTypePre.includes("_")) return res.json(fail("codeTypePre不能含有“_”"));

    const codeType = await projectService.generateNextTypeCodeByPrefix(codeTypePre.trim());

    await projectService.insertProjectAll(projectName.trim(), codeType, code, value);

    res.json(success("插入成功"));
  } catch (e) {
    console.error("[ERROR]插入数据失败：", e);
    res.json(fail("系统繁忙，插入数据失败"));
  }
});

/**
 * @swagger
 * /project/data:
 *   put:
 *     summary: 修改项目数据
 *     tags:
 *       - Project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: 数据ID
 *               code:
 *                 type: string
 *                 description: 新的编码
 *               value:
 *                 type: string
 *                 description: 新的值
 *     responses:
 *       200:
 *         description: 修改成功
 */
router.put("/project/data", async (req, res) => {

  const { id, code, value } = req.body;

  try {
    if (!id) return res.json(fail("id 是必须的"));
    if (!code && !value) return res.json(fail("code 和 value 不能同时为空"));

    await projectService.updateCoVeById(id, code, value);
    res.json(success("修改成功"))
  } catch (err) {
    console.error("[ERROR] 更新 dict_data 失败：", err);
    res.json(fail("系统错误，更新失败"));
  }
});

/**
 * @swagger
 * /project/data/{id}:
 *   delete:
 *     summary: 根据ID删除数据
 *     tags:
 *       - Project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 数据ID
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete("/project/data/:id", async (req, res) => {

  const { id } = req.params;

  try {
    if (!id) return res.json(fail("id 参数不能为空"));

    const result = await projectService.deleteById(id);

    if (result.affectedRows === 0){
      return res.json(fail("未找到对应的数据或者已经删除"));
    }

    res.json(success("删除成功!"))
  } catch (err) {
    console.error("[ERROR] 删除 dict_data 失败:", err);
    res.json(fail("系统繁忙,删除失败"));
  }
});

module.exports = router;
