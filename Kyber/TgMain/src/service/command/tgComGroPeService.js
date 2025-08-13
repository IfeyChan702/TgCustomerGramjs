const db = require("../../models/mysqlModel");

exports.getPageCommandPermissions = async ({ commandId, keyword, status, offset, limit }) => {

  const params = [];
  let baseSql = ` FROM tg_command_group_permission WHERE command_id = ?`;


  if (keyword && keyword.trim() !== "") {
    baseSql += ` AND (group_name LIKE ? OR CAST(group_id AS CHAR) LIKE ?)`;
    const likeKeyword = `%${keyword.trim()}%`;
    params.push(likeKeyword, likeKeyword);
  }

  if (status === 0 || status === 1) {
    baseSql += ` AND status = ?`;
    params.push(status);
  }

  const dataSql = `
    SELECT group_id, group_name, status, remark, create_time
    ${baseSql}
    ORDER BY create_time DESC
    LIMIT ?, ?
  `;

  const countSql = `SELECT COUNT(*) AS total ${baseSql}`;

  try {
    const countResult = await db.query(countSql, params);
    const total = countResult[0]?.total || 0;
    const dataResult = await db.query(dataSql, [...params, offset, limit]);

    return {
      list: dataResult,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    };

  } catch (err) {
    throw err;
  }
};
