const util = require("util");
const db = require("../models/mysqlModel");

/**
 * 接口：返回key，value
 * @param projectId
 * @param key
 * @returns {Promise<unknown>}
 */
exports.getProject = async (projectId, key) => {

  return new Promise((resolve, reject) => {
    const sql = `
        SELECT dd.code AS code, dd.value AS value
        FROM dict_type dt
            LEFT JOIN dict_data dd
        ON dd.type_code = dt.code
        WHERE dt.project_id = ?
          AND dd.code = ?
    `;
    const params = [projectId, key];
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 *
 * @param projectId
 * @returns {Promise<unknown>}
 */
exports.getVerDonByProId = async (projectId) => {

  return new Promise((resolve, reject) => {
    const sql = `
        SELECT dd.code AS code, dd.value AS value
        FROM dict_type dt
            LEFT JOIN dict_data dd
        ON dd.type_code = dt.code
        WHERE dt.project_id = ?
          AND dd.code IN ('version'
            , 'download_url')
    `;
    db.query(sql, [projectId], (err, result) => {
      if (err) return reject(err);

      let version = "";
      const domainList = [];
      result.forEach(item => {
        if (item.code === "version") {
          version = item.value;
        } else if (item.code === "download_url") {
          if (item.value.includes(",")) {
            const urls = item.value.split(",").map(url => url.trim()).filter(url => !!url);
            domainList.push(...urls);
          } else {
            domainList.push(item.value.trim());
          }
        }
      });
      resolve({ version, domainList });
    });
  });
};
/**
 * 条件+模糊+分页查询
 * @param params
 * @returns {Promise<void>}
 */
exports.getProjectData = async (params) => {
  const {
    projectId = null,
    keyword = null,
    code = null,
    page = 1,
    size = 10
  } = params;

  const offset = (page - 1) * size;
  const values = [];
  const countValues = [];

  let baseSQL = `
    FROM dict_data dd
    LEFT JOIN dict_type dt ON dd.type_code = dt.code
    LEFT JOIN dict_projects dp ON dt.project_id = dp.id
    WHERE 1 = 1
  `;
  if (projectId !== null) {
    baseSQL += ` AND dp.id = ?`;
    values.push(projectId);
    countValues.push(projectId);
  }

  if (code !== null) {
    baseSQL += ` AND dd.code = ?`;
    values.push(code);
    countValues.push(code);
  }

  if (keyword) {
    baseSQL += ` AND(
      dp.name LIKE ? OR
      dd.code LIKE ? OR
      dd.value LIKE ? 
    )`;

    const kw = `%${keyword}%`;
    values.push(kw, kw, kw);
    countValues.push(kw, kw, kw);
  }

  const countSQL = `SELECT COUNT(*) AS total` + baseSQL;
  const dataSQL = `
    SELECT dd.id, dd.code, dd.value,
           dt.code AS type_code,
           dp.id AS project_id, dp.name AS project_name
    ` + baseSQL + `
    ORDER BY dd.id DESC
    LIMIT ? OFFSET ?
  `;

  values.push(size, offset);

  return new Promise((resolve, reject) => {
    db.query(countSQL, countValues, (err, countResult) => {
      if (err) return reject(err);

      db.query(dataSQL, values, (err, dataResult) => {
        if (err) return reject(err);

        resolve({
          total:countResult[0].total,
          list: dataResult
        })
      });
    });
  });

};
