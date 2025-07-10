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
  return new Promise((resolve,reject) => {
    let sql = `
      SELECT COUNT(*) AS total
      FROM dict_data
      WHERE project_id = ?
    `
    const values = [projectId];
    if (key && key !== ""){
      sql += ` AND \`key\` = ?`
      values.push(key);
    }
    db.query(sql,values,(err,result) => {
      if (err) return reject(err)
      resolve(result);
    });
  });
};
