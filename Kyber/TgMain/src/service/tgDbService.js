const connection = require("../models/mysqlModel");

// Function to get the top registerId
const getTopRegisterId = () => {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT registerId FROM my_database.tg_accounts LIMIT 1 OFFSET 1",
      (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results[0]?.registerId);
        }
      }
    );
  });
};

// Function to get account details based on registerId
const getAccountByRegisterIdArray = (registerIds) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(registerIds) || registerIds.length === 0) {
      return reject(new Error("registerIds must be a non-empty array"));
    }

    const sql = `SELECT * FROM my_database.tg_accounts WHERE registerId IN (?)`;

    connection.query(sql, [registerIds], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};


// Function to insert data into `tg_groups_channel`
const insertGroupChannel = (tg_account_id, group_id, chat_id, group_name, role, template_id) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO my_database.tg_groups_channel 
            (tg_account_id, group_id, chat_id, group_name, role, template_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE group_id = VALUES(group_id), group_name = VALUES(group_name), 
                role = VALUES(role), template_id = VALUES(template_id), created_at = CURRENT_TIMESTAMP`;

    const values = [tg_account_id, group_id, chat_id, group_name, role, template_id];

    connection.query(sql, values, (err, result) => {
      if (err) {
        reject(err);
      } else {
        // If update happens, MySQL sets affectedRows to 2 (1 insert + 1 update)
        resolve(result.affectedRows > 1 ? 0 : result.insertId);
      }
    });
  });
};

// Function to insert data into `tg_groups_merchant`
const insertGroupMerchant = (tg_account_id, chat_id, group_name, role, template_id) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO my_database.tg_groups_merchant
            (tg_account_id, chat_id, group_name, role, template_id, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    const values = [tg_account_id, chat_id, group_name, role, template_id];

    connection.query(sql, values, (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          resolve(0);
        } else {
          reject(err);
        }
      } else {
        resolve(result.insertId);
      }
    });
  });
};

const getChatIdsByAccountInMerchant = (registerIdSet) => {
  return new Promise((resolve, reject) => {
    const registerIds = Array.from(registerIdSet);

    if (registerIds.length === 0) {
      return resolve(new Set()); // No IDs provided, return empty Set
    }

    const placeholders = registerIds.map(() => '?').join(', ');
    const sql = `SELECT chat_id FROM my_database.tg_groups_merchant WHERE tg_account_id IN (${placeholders})`;

    connection.query(sql, registerIds, (error, results) => {
      if (error) {
        reject(error);
      } else {
        const merchantGroupIds = new Set(results.map(row => row.chat_id));
        resolve(merchantGroupIds);
      }
    });
  });
};

const getChatIdsByAccountInChannel = (registerIdSet) => {
  return new Promise((resolve, reject) => {
    const registerIds = Array.from(registerIdSet);

    if (registerIds.length === 0) {
      return resolve(new Set()); // No IDs provided, return empty Set
    }

    const placeholders = registerIds.map(() => '?').join(', ');
    const sql = `SELECT chat_id FROM my_database.tg_groups_channel WHERE tg_account_id IN (${placeholders})`;

    connection.query(sql, registerIds, (error, results) => {
      if (error) {
        reject(error);
      } else {
        const channelGroupIds = new Set(results.map(row => row.chat_id));
        resolve(channelGroupIds);
      }
    });
  });
};

const getChatIdsByChannelIdInChannel = (channelId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT chat_id FROM tg_groups_channel WHERE group_id = ? ORDER BY created_at DESC";

    connection.query(sql, [channelId], (error, results) => {
      if (error) {
        reject(error);
      } else {
        const chatIds = results.map(row => row.chat_id); // Extract all chat_id values
        resolve(chatIds); // Returns an array (could be empty)
      }
    });
  });
};


// Function to get latest register IDs
const getLatestRegisterIds = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT t1.registerId
        FROM my_database.tg_accounts t1
                 JOIN (
            SELECT phone, MAX(created_at) AS latest_created_at
            FROM my_database.tg_accounts
            WHERE is_running = 1
            GROUP BY phone
        ) t2 ON t1.phone = t2.phone AND t1.created_at = t2.latest_created_at;
        `;

    connection.query(sql, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results.map(row => row.registerId));
      }
    });
  });
};

// Function to get latest register IDs
const getLatestAccountIds = async () => {
  return new Promise((resolve, reject) => {
    const sql = `
        SELECT t1.id
        FROM my_database.tg_accounts t1
                 JOIN (
            SELECT phone, MAX(created_at) AS latest_created_at
            FROM my_database.tg_accounts
            WHERE is_running = 1
            GROUP BY phone
        ) t2 ON t1.phone = t2.phone AND t1.created_at = t2.latest_created_at;
        `;

    connection.query(sql, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

async function getReplyText(matchRule) {
  try {
    const [rows] = await connection.promise().query(
      `SELECT reply_text FROM tg_reply WHERE match_rule = ? LIMIT 1`,
      [matchRule]
    );

    return rows.length > 0 ? rows[0].reply_text : null;
  } catch (error) {
    console.error('Error fetching reply text:', error);
    return null;
  }
}

// Export the function
module.exports = { getReplyText,getLatestAccountIds,getLatestRegisterIds ,getTopRegisterId, getAccountByRegisterIdArray,
  insertGroupChannel, getChatIdsByAccountInChannel,getChatIdsByAccountInMerchant,insertGroupMerchant,getChatIdsByChannelIdInChannel };
