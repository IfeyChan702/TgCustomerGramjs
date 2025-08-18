const db = require("../../models/mysqlModel");
const { param } = require("express/lib/application");
const { rejects } = require("node:assert");
/**
 * 分页查询、模糊查询、条件查询
 * @param commandId
 * @param keyword
 * @param status
 * @param offset
 * @param limit
 * @return {Promise<{total: (*|number), pageSize, page: number, list: *}>}
 */
exports.getPageCommandPermissions = async ({ commandId, keyword, status, offset, limit }) => {

  const params = [commandId];

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

  // 这里只返回一个 Promise，把两次查询都放进来
  return new Promise((resolve, reject) => {
    db.query(countSql, params, (err, countRows) => {
      if (err) return reject(err);

      const total = countRows?.[0]?.total ?? 0;

      db.query(dataSql, [...params, offset, limit], (err2, dataRows) => {
        if (err2) return reject(err2);

        resolve({
          list: dataRows,
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit
        });
      });
    });
  });
};
/**
 * 根据commandId和groupId查询
 * @param commandId
 * @param groupId
 * @return {Promise<void>}
 */
exports.getCommandPerByCommandIdAndGroupId = async (commandId, groupId) => {

  return new Promise((resolve, reject) => {
    const sql = `
        SELECT id
        FROM tg_command_group_permission
        WHERE command_id = ?
          AND group_id = ? LIMIT 1
    `;
    db.query(sql, [commandId, groupId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 插入数据
 * @param commandId
 * @param groupId
 * @param status
 * @param groupName
 * @param remark
 * @return {Promise<*>}
 */
exports.insertCommandPermissions = async ({ commandId, groupId, status, groupName, remark }) => {
  const sql = `
      INSERT INTO tg_command_group_permission
          (command_id, group_id, group_name, status, remark, create_time)
      VALUES (?, ?, ?, ?, ?, NOW())
  `;
  return new Promise((resolve, reject) => {
    db.query(sql, [commandId, groupId, groupName, status, remark], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 修改数据
 * @param id
 * @param groupId
 * @param status
 * @param groupName
 * @param remark
 * @return {Promise<*>}
 */
exports.updateCommandPermission = async ({ id, groupId, status, groupName, remark }) => {

  const fields = [];
  const params = [];

  if (groupId !== undefined) {
    if (groupId === null || isNaN(parseInt(groupId))) {
      fields.push("group_id = NULL");
    } else {
      fields.push("group_id = ?");
      params.push(parseInt(groupId));
    }
  }

  if (status !== undefined) {
    if (status === 0 || status === 1) {
      fields.push("status = ?");
      params.push(status);
    } else {
      throw new Error("status 必须是 0 或 1");
    }
  }
  if (groupName !== undefined) {
    fields.push("group_name = ?");
    params.push(groupName.trim());
  }
  if (remark !== undefined) {
    fields.push("remark = ?");
    params.push(remark.trim());
  }

  if (fields.length === 0) {
    throw new Error("没有需要更新的字段");
  }

  const sql = `UPDATE tg_command_group_permission
               SET ${fields.join(",")}
               WHERE id = ?`;
  params.push(id);

  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
/**
 * 根据id删除信息
 * @param id
 * @return {Promise<*>}
 */
exports.deleteById = async (id) => {
  const sql = `DELETE
               FROM tg_command_group_permission
               WHERE id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [id], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};
