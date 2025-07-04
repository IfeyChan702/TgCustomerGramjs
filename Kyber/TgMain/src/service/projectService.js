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
