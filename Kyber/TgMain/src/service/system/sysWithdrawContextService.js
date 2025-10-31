const db = require("../../models/mysqlModel");

exports.insert = async (data) => {
  const sql = `
    INSERT INTO sys_withdraw_context (
      order_id,
      merchant_no,
      merchant_name,
      currency,
      amount,
      balance_available,
      usdt_address,
      address_hint,
      exchange_rate,
      usdt_final,
      apply_time,
      opt_type,
      is_same_address,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      merchant_no = VALUES(merchant_no),
      merchant_name = VALUES(merchant_name),
      currency = VALUES(currency),
      amount = VALUES(amount),
      balance_available = VALUES(balance_available),
      usdt_address = VALUES(usdt_address),
      address_hint = VALUES(address_hint),
      exchange_rate = VALUES(exchange_rate),
      usdt_final = VALUES(usdt_final),
      apply_time = VALUES(apply_time),
      opt_type = VALUES(opt_type),
      is_same_address = VALUES(is_same_address),
      updated_at = NOW();
  `;

  const params = [
    data.orderId,
    data.merchantNo,
    data.merchantName,
    data.currency,
    data.amount,
    data.balanceAvailable,
    data.usdtAddress || null,
    data.addressHint || null,
    data.exchangeRate,
    data.usdtFinal,
    data.applyTime,
    data.optType,
    data.isSameAddress ? 1 : 0
  ];

  try {
    const [result] = await db.query(sql, params);
    return result;
  } catch (err) {
    console.error("sysWithdrawContextService-insert() error:", err);
    throw err;
  }
};


exports.findByOrderIdAndMerchantNo = async (orderId, merchantNo) => {
  const sql = `
    SELECT *
    FROM sys_withdraw_context
    WHERE order_id = ? AND merchant_no = ?
    LIMIT 1
  `;
  try {
    const [rows] = await db.query(sql, [orderId, merchantNo]);
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error("sysWithdrawContextService-findByOrderIdAndMerchantNo() error:", err);
    throw err;
  }
};

exports.findByOrderIdAndMerchantNo = async (orderId, merchantNo) => {
  const sql = `
      SELECT
          id,
          order_id AS orderId,
          merchant_no AS merchantNo,
          merchant_name AS merchantName,
          currency,
          amount,
          balance_available AS balanceAvailable,
          usdt_address AS usdtAddress,
          address_hint AS addressHint,
          exchange_rate AS exchangeRate,
          usdt_final AS usdtFinal,
          apply_time AS applyTime,
          opt_type AS optType,
          is_same_address AS isSameAddress,
          status,
          created_at AS createdAt,
          updated_at AS updatedAt
      FROM sys_withdraw_context
      WHERE order_id = ? AND merchant_no = ?
          LIMIT 1
  `;

  try {
    const [rows] = await db.query(sql, [orderId, merchantNo]);
    if (rows && rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (err) {
    console.error(
      "sysWithdrawContextService-findByOrderIdAndMerchantNo() error:",
      err
    );
    throw err;
  }
};

