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
