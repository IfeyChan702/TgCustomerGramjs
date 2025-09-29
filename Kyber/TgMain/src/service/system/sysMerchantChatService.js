const db = require("../../models/mysqlModel");

exports.getChatIdAndReviewer = async (merchantNo, role = "audit") => {
  const sql = `
      SELECT s.chat_id, s.reviewer_ids
      FROM sys_merchant_chat s
      WHERE s.merchant_no = ?
        AND s.role = ? LIMIT 1
  `;
  const [rows] = await db.query(sql, [merchantNo, role]);
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

exports.getMerchantNoByChatId = async (chatId) => {

  console.log("查询 chatId =", chatId, "类型 =", typeof chatId);


  const sql = `
      SELECT merchant_no
      FROM sys_merchant_chat
      WHERE chat_id = ? LIMIT 1
  `;
  const [rows] = await db.query(sql, [chatId]);
  console.log('rows=',rows);
  return rows?.[0]?.merchant_no || null;
};
