const util = require("util");
const db = require("../../models/mysqlModel");
const { rejects } = require("node:assert");
const { valueOf } = require("jest");
const { insertData } = require("./projectDataService");

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
          total: countResult[0].total,
          list: dataResult
        });
      });
    });
  });
};

/**
 * 插入project三个表的数据
 * @param projectName
 * @param codeType
 * @param code
 * @param value
 * @returns {Promise<void>}
 */
exports.insertProjectAll = async (projectName, codeType, code, value) => {
  return new Promise((resolve, reject) => {
    db.query(`SELECT id
              FROM dict_projects
              WHERE name = ? LIMIT 1`, [projectName], (err, projectRows) => {

      if (err) return reject(err);
      let projectId;

      const insertTypeAndData = () => {
        db.query(`SELECT id
                  FROM dict_type
                  WHERE project_id = ?
                    AND code = ?`, [projectId, codeType], (err, typeRows) => {
          if (err) return reject(err);

          const insertData = () => {
            db.query(`INSERT INTO dict_data (type_code, code, value)
                      VALUES (?, ?, ?)`, [codeType, code, value], (err) => {
              if (err) return reject(err);
              return resolve("插入成功");
            });
          };

          if (typeRows.length > 0) {
            insertData();
          } else {
            db.query(
              `INSERT INTO dict_type (project_id, code)
               VALUES (?, ?)`,
              [projectId, codeType],
              (err) => {
                if (err) return reject(err);
                insertData();
              }
            );
          }
        });
      };

      if (projectRows.length > 0) {
        projectId = projectRows[0].id;
        insertTypeAndData();
      } else {
        db.query(`INSERT INTO dict_projects(name)
                  VALUES (?)`, [projectName], (err, result) => {
          if (err) return reject(err);
          projectId = result.insertId;
          insertTypeAndData();
        });
      }
    });
  });
};

/**
 * 根据前缀生成下一个可用的 type_code
 * @param prefix
 * @returns {Promise<string>}
 */
exports.generateNextTypeCodeByPrefix = async (prefix = "project") => {
  const value = `${prefix}_%`;
  const sql = `
      SELECT code
      FROM dict_type
      WHERE code LIKE ?
      ORDER BY id DESC LIMIT 1
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, [value], (err, result) => {
      if (err) return reject(err);
      let suffix = 1;
      if (result.length > 0) {
        const match = result[0].code.match(/_(\d+)$/);
        if (match) {
          suffix = parseInt(match[1]) + 1;
        }
      }
      return resolve(`${prefix}_${suffix}`);
    });
  });
};
/**
 * 根据id修改code或者value
 * @param id
 * @param code
 * @param value
 * @return {Promise<void>}
 */
exports.updateCoVeById = async (id, code, value) => {
  return new Promise((resolve, reject) => {
    let sql = `UPDATE dict_data
               SET `;
    const params = [];
    if (code) {
      sql += `code = ? `;
      params.push(code);
    }

    if (value) {
      if (code) sql += `, `;
      sql += `value = ? `;
      params.push(value);
    }

    sql += `WHERE id = ?`;
    params.push(id);
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id删除数据
 * @param deleteId
 * @return {Promise<unknown>}
 */
exports.deleteById = (deleteId) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE
                 FROM dict_data
                 WHERE id = ?`;

    db.query(sql, [deleteId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};


/**
 * 模糊查询，分页查询project
 * @param offset
 * @param limit
 * @param keyword
 * @return {Promise<unknown>}
 */
exports.queryPageProject = async (offset, limit, keyword) => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT id, name
        FROM dict_projects
        WHERE name LIKE ?
        ORDER BY id DESC LIMIT ?, ?
    `;
    db.query(sql, [`%${keyword}%`, offset, limit], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 模糊查询project的数量
 * @param keyword
 * @return {Promise<unknown>}
 */
exports.queryCountProject = async (keyword) => {
  return new Promise((resolve, reject) => {
    let sql = `
        SELECT COUNT(*) AS total
        FROM dict_projects
        WHERE 1 = 1
    `;
    const values = [];
    if (keyword && keyword !== "") {
      sql += ` AND name LIKE ?`;
      values.push(`%${keyword}%`);
    }
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据projectName查询project的数据
 * @param projectName
 * @return {Promise<unknown>}
 */
exports.queryProjectByName = async (projectName) => {
  const sql = `SELECT COUNT(*) AS total
               FROM dict_projects
               WHERE name = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [projectName], (err, result) => {
      if (err) return reject(err);
      resolve(result[0].total > 0);
    });
  });
};

/**
 * 插入到project一条数据
 * @param projectName
 * @return {Promise<void>}
 */
exports.insertProject = async (projectName) => {

  const sql = `INSERT INTO dict_projects (name)
               VALUES (?)`;

  return new Promise((resolve, reject) => {
    db.query(sql, [projectName.trim()], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id查询用户
 * @param id
 * @return {Promise<void>}
 */
exports.queryProjectById = async (id) => {
  const sql = `SELECT *
               FROM dict_projects
               WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null); // 如果没有则返回 null
    });
  });
};
/**
 * 根据id修改projectName的数据
 * @param id
 * @param projectName
 * @return {Promise<unknown>}
 */
exports.updateProjectNameById = async (id, projectName) => {
  const sql = `UPDATE dict_projects
               SET name = ?
               WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [projectName, id], (err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  });
};
