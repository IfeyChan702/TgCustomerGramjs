const db = require("../models/mysqlModel");

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
    const countValuse = [];

    let baseSQL = `FROM tg_command_list WHERE 1 = 1`;

    if (method) {
      baseSQL += ` AND method = ?`;
      values.push(method);
      countValuse.push(method);
    }

    if (identifier) {
      baseSQL += ` AND identifier = ?`;
      values.push(identifier);
      countValuse.push(identifier);
    }

    if (keyword && keyword !== "") {
      baseSQL += ` AND( url LIKE ? OR identifier LIKE ? OR description LIKE ?)`;

      const likeKeyword = `%${keyword}%`;
      values.push(likeKeyword, likeKeyword, likeKeyword);
      countValuse.push(likeKeyword, likeKeyword, likeKeyword);
    }

    const countSQL = `SELECT COUNT(*) AS total ` + baseSQL;
    const dataSQL = `SELECT identifier,url,method,description ` + baseSQL + ` ORDER BY id DESC LIMIT ? OFFSET ?`;

    values.push(size, offset);

    db.query(countSQL, countValuse, (err, countResult) => {
      if (err) return reject(err);

      db.query(dataSQL, values, (err, dataResult) => {
        if (err) return reject(err);

        resolve({
          total: countResult[0].total,
          data: dataResult
        });
      });
    });
  });
};
