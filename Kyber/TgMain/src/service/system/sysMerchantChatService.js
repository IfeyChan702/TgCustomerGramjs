const db = require("../../models/mysqlModel");

exports.getChatIdAndReviewer = async (merchantId, role = "audit") => {
  const sql = `
      SELECT s.chat_id, s.reviewer_ids
      FROM sys_merchant_chat s
      WHERE s.merchant_id = ?
        AND s.role = ? LIMIT 1
  `;
  const [rows] = await db.query(sql, [merchantId, role]);
  if (!rows?.length) return null;

  const row = rows[0];
  let reviewerIds = [];
  if (row.reviewer_ids) {
    try {
      const arr = typeof row.reviewer_ids === "string" ? JSON.parse(row.reviewer_ids) : row.reviewer_ids;
      reviewerIds = (arr || []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    } catch (e) {
      reviewerIds = [];
    }
  }
  return { chatId: Number(row.chat_id), reviewerIds };
};
