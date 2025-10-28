const db = require("../../models/mysqlModel");

exports.getChatInfoByMerchant = async (merchantNo) => {
  const sql = `
    SELECT s.chat_id, s.reviewer_ids, s.approve_ids
    FROM sys_merchant_chat s
    WHERE s.merchant_no = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [merchantNo]);
  if (!rows?.length) return null;

  const row = rows[0];

  // 通用的 JSON 字段解析函数
  const parseJsonIds = (value) => {
    if (!value) return [];
    try {
      const arr = typeof value === "string" ? JSON.parse(value) : value;
      return (arr || []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    } catch (e) {
      return [];
    }
  };

  const reviewerIds = parseJsonIds(row.reviewer_ids);
  const approveIds = parseJsonIds(row.approve_ids);

  return {
    chatId: Number(row.chat_id),
    reviewerIds,
    approveIds,
  };
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
