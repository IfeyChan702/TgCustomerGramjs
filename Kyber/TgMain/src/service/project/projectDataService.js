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
        SELECT id, \`key\`, value, description
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
exports.insertData = async (projectId, key, value, description) => {
  return new Promise((resolve, reject) => {
    const sql = `
        INSERT INTO dict_data (project_id, \`key\`, value, description)
        VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [projectId, key, value, description || null], (err, result) => {
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

  const sql = `SELECT *
               FROM dict_data
               WHERE id = ? LIMIT 1`;

  return new Promise((resolve, reject) => {

    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};
/**
 * 根据id修改projectData的数据
 * @param id
 * @param key
 * @param value
 * @param description
 * @return {Promise<unknown>}
 */
exports.updateDataById = async (id, key, value, description) => {
  return new Promise((resolve, reject) => {
    const sql = `
        UPDATE dict_data
        SET \`key\`     = ?,
            value       = ?,
            description = ?
        WHERE id = ?
    `;
    db.query(sql, [key, value, description, id], (err, result) => {
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
  const sql = `SELECT *
               FROM dict_data
               WHERE project_id = ?
                 AND \`key\` = ?
                 AND value = ? LIMIT 1`;

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
  const sql = `DELETE
               FROM dict_data
               WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
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
    let sql = `
        SELECT \`key\`, value
        FROM dict_data
        WHERE project_id = ?
    `;
    const values = [projectId];

    // 只有当 key 非空字符串才加条件
    if (key && key.trim() !== "") {
      sql += ` AND \`key\` = ?`;
      values.push(key.trim());
    }

    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据projectId删除数据
 * @param projectId
 * @return {Promise<unknown>}
 */
exports.deleteByProjectId = (projectId) => {
  return new Promise((resolve, reject) => {
    const sql = `
        DELETE
        FROM dict_data
        WHERE project_id = ?
    `;

    db.query(sql, [projectId], (err, result) => {
      if (err) {
        console.error("[ERROR] 删除 dict_data 失败:", err);
        return reject(err);
      }

      return resolve(result);
    });
  });
};
