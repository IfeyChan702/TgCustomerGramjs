const db = require("../../models/mysqlModel");

/**
 * 根据commandListId查询数据
 * @param commandListId
 * @return {Promise<unknown>}
 */
exports.getPageParameter = (commandListId) => {

  return new Promise((resolve, reject) => {
    const sql = `SELECT id, parameter_name, parameter_value, required
                 FROM tg_parameter_list
                 WHERE command_list_id = ? ORDER BY ID DESC`;
    db.query(sql, [commandListId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

/**
 * 增加数据
 * @param commandListId
 * @param parameterName
 * @param parameterValue
 * @param required
 * @return {Promise<unknown>}
 */
exports.insertParameter = (commandListId, parameterName, parameterValue, required) => {
  const sql = `
    INSERT INTO tg_parameter_list (command_list_id, parameter_name, parameter_value, required)
    VALUES (?, ?, ?, ?)
  `;

  return new Promise((resolve, reject) => {
    db.query(sql, [commandListId, parameterName, parameterValue, required], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id查询数据
 * @param id
 * @return {Promise<unknown>}
 */
exports.queryParameterById = (id) => {
  const sql = `SELECT * FROM tg_parameter_list WHERE id = ? LIMIT 1`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};
/**
 * 修改数据
 * @param id
 * @param name
 * @param value
 * @param required
 * @return {Promise<unknown>}
 */
exports.updateParameterById = (id, name, value, required) => {
  const sql = `
    UPDATE tg_parameter_list
    SET parameter_name = ?, parameter_value = ?, required = ?
    WHERE id = ?
  `;
  return new Promise((resolve, reject) => {
    db.query(sql, [name, value, required, id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id删除数据
 * @param id
 * @return {Promise<unknown>}
 */
exports.deleteParameterById = (id) => {
  const sql = `DELETE FROM tg_parameter_list WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
