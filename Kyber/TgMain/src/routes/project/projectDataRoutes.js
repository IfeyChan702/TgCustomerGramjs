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
 * 新增project的data数据
 */
router.post("/project/data", async (req, res) => {
  const { projectId, key, value, description } = req.body;

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

    const insertResult = await projectDataService.insertData(proId, finalKey, finalValue, description);

    if (insertResult.affectedRows === 1) {
      return res.json(success("数据插入成功!"));
    } else {
      return res.json(fail("数据插入失败!"));
    }

  } catch (e) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.json(fail("数据库已存在该 key，无需重复修改"));
    }
    console.error(`[ERROR] 插入projectData失败:`, e);
    res.json(fail("系统繁忙，插入projectData失败"));
  }
});
/**
 * 修改project的data
 */
router.put("/project/data", async (req, res) => {
  const { id, key, value, description } = req.body;

  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id不能为空且必须为数字"));
  }

  const dataId = parseInt(id);
  const hasNewKey = typeof key === "string" && key.trim() !== "";
  const hasNewValue = value !== undefined && value !== null && value.toString().trim() !== "";
  const hasNewDescription = description !== undefined;

  if (!hasNewKey && !hasNewValue && !hasNewDescription) {
    return res.json(fail("key、value 和 description 不能同时为空"));
  }

  const finalNewKey = hasNewKey ? key.trim() : null;
  const finalNewValue = hasNewValue ? value.toString().trim() : null;
  const finalNewDescription = hasNewDescription ? description.toString().trim() : null;

  try {
    const origin = await projectDataService.queryDataById(dataId);
    if (!origin) {
      return res.json(fail("该 id 对应的数据不存在"));
    }

    const finalKey = finalNewKey ?? origin.key;
    const finalValue = finalNewValue ?? origin.value;
    const finalDescription = finalNewDescription ?? origin.description;

    const isKeySame = finalKey === origin.key;
    const isValueSame = finalValue === origin.value;
    const isDescriptionSame = finalDescription === origin.description;

    if (isKeySame && isValueSame && isDescriptionSame) {
      return res.json(fail("key、value 和 description 都未变化，无需修改"));
    }

    // 判断项目中是否已存在相同的 key + value
    const exists = await projectDataService.queryDataByProIdKeyValue(
      origin.project_id,
      finalKey,
      finalValue
    );
    if (exists && exists.id !== dataId) {
      return res.json(fail("该 key 和 value 在项目中已存在"));
    }

    // 执行更新
    const result = await projectDataService.updateDataById(
      dataId,
      finalKey,
      finalValue,
      finalDescription
    );

    if (result.affectedRows === 1) {
      return res.json(success("修改成功！"));
    } else {
      return res.json(fail("修改失败！"));
    }

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.json(fail("数据库已存在该 key，无需重复修改"));
    }
    console.error(`[ERROR] 修改数据失败:`, err);
    res.json(fail("系统繁忙，修改失败"));
  }
});

/**
 * 删除 project_data数据
 */
router.delete("/project/data/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    return res.json(fail("id 不能为空，且必须为数字"));
  }

  const dataId = parseInt(id);

  try {
    const origin = await projectDataService.queryDataById(dataId);
    if (!origin) {
      return res.json(fail("该 id 对应的数据不存在"));
    }

    const result = await projectDataService.deleteById(dataId);
    if (result.affectedRows === 1) {
      return res.json(success("删除成功！"));
    } else {
      return res.json(fail("删除失败！"));
    }

  } catch (err) {
    console.error("[ERROR] 删除 project_data 失败:", err);
    res.json(fail("系统繁忙，删除失败"));
  }
});

/**
 * 接口给一个key+projectId获得value
 */
router.get("/project/data/value", async (req, res) => {
  const { projectId, key = "" } = req.query;

  if (!projectId || isNaN(parseInt(projectId))) {
    return res.json(fail("projectId 不能为空且必须为数字"));
  }

  const proId = parseInt(projectId);
  const finalKey = key.trim();

  try {
    const result = await projectDataService.getValueByProjectIdAndKey(proId, finalKey);

    let responseData = {};

    if (finalKey) {
      responseData[finalKey] = result.map(row => row.value).join(",");
    } else {
      result.forEach(row => {
        responseData[row.key] = row.value;
      });
    }

    res.json(success200(responseData));
  } catch (err) {
    console.error(`[ERROR] 查询数据失败:`, err);
    res.json(fail500("系统繁忙，查询失败"));
  }
});

module.exports = router;
