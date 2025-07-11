const util = require("util");
const db = require("../../models/mysqlModel");
const { rejects } = require("node:assert");
const { valueOf } = require("jest");

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

