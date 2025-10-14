const db = require("../../models/mysqlModel");
const { param } = require("express/lib/application");
const { rejects } = require("node:assert");


/**
 * 根据 commandId 获取命令返回格式配置
 * @param {number} commandId
 * @returns {Promise<{format_type:string, format_template:string, enabled:number}|null>}
 */
exports.getFormatByCommandId = async (commandId) => {
  try {
    const sql = `
      SELECT format_type, format_template, enabled
      FROM tg_command_format
      WHERE command_id = ?
      AND enabled = 1
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [commandId]);
    return rows?.[0] || null;
  } catch (err) {
    console.error("[tgComFormatService.getFormatByCommandId] 查询失败:", err);
    return null;
  }
};
