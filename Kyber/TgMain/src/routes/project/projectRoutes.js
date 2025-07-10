const express = require("express");
const router = express.Router();
const { success, fail, fail500, success200 } = require("../../utils/responseWrapper");
const projectService = require("../../service/project/projectService");
const { exists } = require("node:fs");
/**
 * 根据projectId，key获取key和value的接口
 * @param projectId
 * @param key
 */
/*
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
*/

/**
 * 获取projectId为1的version和download_url的值
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
 * 查询项目数据：支持分页、模糊、条件查询project数据
 */
/*router.get("/project/data", async (req, res) => {
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
});*/

/**
 * 插入project的全部数据
 */
/*router.post("/project/data", async (req, res) => {
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
});*/

/**
 * 修改project的数据
 */
/*router.put("/project/data", async (req, res) => {

  const { id, code, value } = req.body;

  try {
    if (!id) return res.json(fail("id 是必须的"));
    if (!code && !value) return res.json(fail("code 和 value 不能同时为空"));

    await projectService.updateCoVeById(id, code, value);
    res.json(success("修改成功"));
  } catch (err) {
    console.error("[ERROR] 更新 dict_data 失败：", err);
    res.json(fail("系统错误，更新失败"));
  }
});*/

/**
 * 根据id删除数据
 */
/*router.delete("/project/data/:id", async (req, res) => {

  const { id } = req.params;

  try {
    if (!id) return res.json(fail("id 参数不能为空"));

    const result = await projectService.deleteById(id);

    if (result.affectedRows === 0) {
      return res.json(fail("未找到对应的数据或者已经删除"));
    }

    res.json(success("删除成功!"));
  } catch (err) {
    console.error("[ERROR] 删除 dict_data 失败:", err);
    res.json(fail("系统繁忙,删除失败"));
  }
});*/

/**
 * 分页查询,模糊查询project
 */
router.get("/project", async (req, res) => {
  const {
    page = 0,
    size = 10,
    keyword = ""
  } = req.query;
  try {
    const offset = parseInt(size) * parseInt(page);
    const limit = parseInt(size);

    const projectList = await projectService.queryPageProject(offset, limit, keyword);
    const countResult = await projectService.queryCountProject(keyword);
    const total = countResult[0]?.total || 0;

    res.json({
      projectList,
      total,
      page: parseInt(page),
      size: parseInt(size)
    });

  } catch (e) {
    console.error(`[ERROR] 查询项目列表失败:`, e);
    res.json(fail("系统繁忙，查询失败!"));
  }
});
/**
 * 插入project数据
 */
router.post("/project", async (req, res) => {
  const {
    projectName
  } = req.body;
  if (!projectName || projectName.trim() === "") {
    res.json(fail("projectName不能为空!"));
  }

  try {

    const exists = await projectService.queryProjectByName(projectName.trim());
    if (exists) {
      return res.json(fail("该项目名称已经存在，请勿重复添加"));
    }

    const result = await projectService.insertProject(projectName);
    if (result.affectedRows === 1) {
      res.json(success("项目插入成功！"));
    } else {
      res.json(fail("项目添加失败"));
    }
  } catch (e) {
    console.error(`[ERROR] 插入失败:`, e);
    res.json(fail("系统操作繁忙，插入失败!"));
  }
});

/**
 * 修改project的数据
 */
router.put("/project", async (req, res) => {
  const { id, projectName } = req.body;

  if (!id || isNaN(parseInt(id))){
    return res.json(fail("项目的ID不能为空，而且必须为数字"));
  }

  if (!projectName || projectName.trim() === ""){
    return  res.json(fail("projectName不能为空!"))
  }

  const projectId = parseInt(id);
  const finalName = projectName.trim();

  try {

    const project = await projectService.queryProjectById(projectId);
    if (!project){
      return res.json(fail("没有这一条数据,无法修改"));
    }

    const exists = await projectService.queryProjectByName(finalName);
    if (exists && exists.id !== projectId) {
      return res.json(fail("该名称已被其他项目使用，请更换一个名称"));
    }

    const result = await projectService.updateProjectNameById(projectId,finalName);

    if (result.affectedRows === 1){
      return res.json(success("修改成功"));
    }else {
      return res.json(fail("修改失败"));
    }

  }catch (err){
    console.error(`[ERROR] 项目修改失败:`,err);
    res.json(fail("系统繁忙，修改失败"));
  }
});

module.exports = router;
