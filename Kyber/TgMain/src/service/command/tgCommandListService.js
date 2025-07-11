const db = require("../../models/mysqlModel");

/**
 * 根据method，identifier条件查询，模糊查询url，identifier，description模糊查询，分页查询
 * @param params
 * @return {Promise<unknown>}
 */
exports.getPageCommands = (params = {}) => {
  return new Promise((resolve, reject) => {
    const {
      method = null, identifier = null, keyword = "", page = 1, size = 10
    } = params;

    const offset = (page - 1) * size;
    const values = [];
    const countValues = [];

    let baseSQL = `FROM tg_command_list WHERE 1 = 1`;

    if (method) {
      baseSQL += ` AND method = ?`;
      values.push(method);
      countValues.push(method);
    }

    if (identifier) {
      baseSQL += ` AND identifier = ?`;
      values.push(identifier);
      countValues.push(identifier);
    }

    if (keyword && keyword !== "") {
      baseSQL += ` AND( url LIKE ? OR identifier LIKE ? OR description LIKE ?)`;

      const likeKeyword = `%${keyword}%`;
      values.push(likeKeyword, likeKeyword, likeKeyword);
      countValues.push(likeKeyword, likeKeyword, likeKeyword);
    }

    const countSQL = `SELECT COUNT(*) AS total ` + baseSQL;
    const dataSQL = `SELECT id,identifier,url,method,description ` + baseSQL + ` ORDER BY id DESC LIMIT ? OFFSET ?`;

    values.push(size, offset);

    db.query(countSQL, countValues, (err, countResult) => {
      if (err) return reject(err);

      db.query(dataSQL, values, (err, dataResult) => {
        if (err) return reject(err);

        resolve({
          total: countResult[0].total,
          page,
          size,
          data: dataResult
        });
      });
    });
  });
};
/**
 * 查询数据是否存在
 * @param identifier
 * @param method
 * @return {Promise<unknown>}
 */
exports.queryCommandByIdentifierAndMethod = (identifier, method) => {
  const sql = `SELECT * FROM tg_command_list WHERE identifier = ? AND method = ? LIMIT 1`;

  return new Promise((resolve, reject) => {
    db.query(sql, [identifier, method], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null); // 有则返回记录，无则返回 null
    });
  });
};
/**
 * 插入数据
 * @param identifier
 * @param url
 * @param method
 * @param description
 * @return {Promise<unknown>}
 */
exports.insertCommand = ({ identifier, url, method, description }) => {
  const sql = `
    INSERT INTO tg_command_list (identifier, url, method, description)
    VALUES (?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, [identifier, url, method, description], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 查询指令详情
 * @param id
 * @return {Promise<unknown>}
 */
exports.queryCommandById = (id) => {
  const sql = `SELECT * FROM tg_command_list WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};

/**
 * 根据 identifier 查重
 * @param identifier
 * @return {Promise<unknown>}
 */
exports.queryByIdentifier = (identifier) => {
  const sql = `SELECT * FROM tg_command_list WHERE identifier = ? LIMIT 1`;
  return new Promise((resolve, reject) => {
    db.query(sql, [identifier], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};

/**
 * 执行更新
 * @param id
 * @param identifier
 * @param url
 * @param method
 * @param description
 * @return {Promise<unknown>}
 */
exports.updateCommandById = (id, identifier, url, method, description) => {
  const sql = `
    UPDATE tg_command_list
    SET identifier = ?, url = ?, method = ?, description = ?
    WHERE id = ?
  `;
  return new Promise((resolve, reject) => {
    db.query(sql, [identifier, url, method, description, id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id删除
 * @param id
 * @return {Promise<unknown>}
 */
exports.deleteCommandById = (id) => {
  const sql = `DELETE FROM tg_command_list WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
