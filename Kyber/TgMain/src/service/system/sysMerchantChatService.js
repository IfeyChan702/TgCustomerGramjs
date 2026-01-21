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
      SELECT merchant_no AS merchantNo, merchant_name AS merchantName
      FROM sys_merchant_chat
      WHERE chat_id = ?
  `;

  const [rows] = await db.query(sql, [chatId]);
  console.log('rows =', rows);

  return (rows || [])
    .filter(r => r?.merchantNo && r?.merchantName)
    .map(r => ({
      merchantNo: r.merchantNo,
      merchantName: r.merchantName
    }));
};

exports.createMerchantChat = async (data) => {
  const sql = `
    INSERT INTO sys_merchant_chat
    (merchant_no, merchant_name, chat_id, approve_ids, role)
    VALUES (?, ?, ?, ?, 'audit')
  `;
  return db.query(sql, [
    data.merchantNo,
    data.merchantName,
    data.chatId,
    JSON.stringify(data.approveIds)
  ]);
};

/**
 * 更新商户聊天的审批人列表
 * @param {string|number} merchantNo 商户编号
 * @param {number[]} approveIds 审批人ID数组
 */
exports.updateApproveIds = (merchantNo, approveIds) => {
  const sql = `
    UPDATE sys_merchant_chat
    SET approve_ids = ?
    WHERE merchant_no = ?
  `;
  return db.query(sql, [JSON.stringify(approveIds), merchantNo]);
};

/**
 * 删除商户聊天绑定记录
 * @param {string|number} merchantNo 商户编号
 */
exports.deleteMerchantChat = (merchantNo) => {
  const sql = `
    DELETE FROM sys_merchant_chat
    WHERE merchant_no = ?
  `;
  return db.query(sql, [merchantNo]);
};

