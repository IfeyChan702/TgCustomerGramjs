const util = require("util");
const db = require("../../models/mysqlModel");
const { rejects } = require("node:assert");
const { valueOf } = require("jest");
const { insertData } = require("./projectDataService");


/**
 * 根据id删除数据
 * @param deleteId
 * @return {Promise<unknown>}
 */
exports.deleteById = (deleteId) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE
                 FROM dict_projects
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
  const sql = `SELECT COUNT(*) AS total FROM dict_projects WHERE name = ?`;
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
exports.insertProject = async (projectName, id) => {
  let sql = "";
  const params = [];

  if (typeof id === 'number') {
    sql = `INSERT INTO dict_projects (id, name) VALUES (?, ?)`;
    params.push(id, projectName);
  } else {
    sql = `INSERT INTO dict_projects (name) VALUES (?)`;
    params.push(projectName);
  }

  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
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
  const sql = `SELECT * FROM dict_projects WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
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
