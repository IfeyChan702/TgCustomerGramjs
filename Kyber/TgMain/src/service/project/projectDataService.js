const util = require("util");
const db = require("../../models/mysqlModel");
const { rejects } = require("node:assert");
const { valueOf } = require("jest");
const domain = require("node:domain");

/**
 * 根据projectId、key条件查询，查询project的数据
 * @param offset
 * @param limit
 * @param projectId
 * @param key
 * @returns {Promise<unknown>}
 */
exports.queryPageData = async (offset = 0, limit = 10, projectId, key) => {

  return new Promise((resolve, reject) => {
    let sql = `
        SELECT id, \`key\`, value
        FROM dict_data
        WHERE project_id = ?
    `;
    const values = [projectId];
    if (key && key !== "") {
      sql += ` AND \`key\` = ?`;
      values.push(key);
    }

    sql += ` ORDER BY id DESC LIMIT ?, ?`;
    values.push(offset);
    values.push(limit);
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据projectId查询data的数量，以及根据key条件查询
 * @param projectId
 * @param key
 * @return {Promise<unknown>}
 */
exports.queryCountData = async (projectId, key) => {
  return new Promise((resolve, reject) => {
    let sql = `
        SELECT COUNT(*) AS total
        FROM dict_data
        WHERE project_id = ?
    `;
    const values = [projectId];
    if (key && key !== "") {
      sql += ` AND \`key\` = ?`;
      values.push(key);
    }
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据projectId,key,value插入一条数据
 * @param projectId
 * @param key
 * @param value
 * @return {Promise<unknown>}
 */
exports.insertData = async (projectId, key, value) => {
  return new Promise((resolve, reject) => {
    let sql = `
        INSERT INTO dict_data (project_id, \`key\`, value)
        VALUES (?, ?, ?)
    `;
    db.query(sql, [projectId, key, value], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id修改，key，value
 * @param id
 * @return {Promise<unknown>}
 */
exports.queryDataById = async (id) => {

  const sql = `SELECT * FROM dict_data WHERE id = ? LIMIT 1`;

  return new Promise((resolve, reject) => {

    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};

exports.updateDataById = async (id, key, value) => {
  let sql = `UPDATE dict_data SET `;
  const updates = [];
  const values = [];

  if (key !== null && key !== undefined) {
    updates.push("`key` = ?");
    values.push(key);
  }

  if (value !== null && value !== undefined) {
    updates.push("`value` = ?");
    values.push(value);
  }

  // 防止 updates 是空的
  if (updates.length === 0) {
    throw new Error("没有字段可更新");
  }

  sql += updates.join(", ") + " WHERE id = ?";
  values.push(id);

  return new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据project_id, key, value，查询数据
 * @param projectId
 * @param key
 * @param value
 * @return {Promise<void>}
 */
exports.queryDataByProIdKeyValue = async (projectId, key, value) => {
  const sql = `SELECT * FROM dict_data WHERE project_id = ? AND \`key\` = ? AND value = ? LIMIT 1`;

  return new Promise((resolve, reject) => {
    db.query(sql, [projectId, key, value], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};
/**
 * 根据 id 删除 dict_data 中的数据
 * @param {number} id
 * @returns {Promise<*>}
 */
exports.deleteById = (id) => {
  const sql = `DELETE FROM dict_data WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据projectId获取key为version、download_url的数据
 * @param projectId
 * @return {Promise<unknown>}
 */
exports.getVersionAndUrlsByProjectId = (projectId) => {
  const sql = `
    SELECT \`key\`, value
    FROM dict_data
    WHERE project_id = ?
      AND \`key\` IN ('version', 'download_url')
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, [projectId], (err, results) => {
      if (err) return reject(err);

      let version = "";
      const domainList = [];

      results.forEach(row => {
        if (row.key === "version") {
          version = row.value;
        } else if (row.key === "download_url") {
          // 允许多行 download_url，并合并多个逗号分隔的 url
          const urls = row.value.split(",").map(v => v.trim()).filter(Boolean);
          domainList.push(...urls);
        }
      });

      resolve({ version, domainList: domainList });
    });
  });
};
/**
 * 根据projectId和key查询value
 * @param projectId
 * @param key
 * @return {Promise<unknown>}
 */
exports.getValueByProjectIdAndKey = (projectId, key) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT value
      FROM dict_data
      WHERE project_id = ?
        AND \`key\` = ?
    `;
    db.query(sql, [projectId, key], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
