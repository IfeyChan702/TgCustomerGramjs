const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


module.exports = {
  query(sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = [];
    }

    if (callback && typeof callback === "function") {
      pool.getConnection((err, connection) => {
        if (err) return callback(err);

        connection.query(sql, params, (error, results, fields) => {
          connection.release();
          callback(error, results, fields);
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
          if (err) return reject(err);

          connection.query(sql, params, (error, results, fields) => {
            connection.release();
            if (error) return reject(error);
            resolve([results, fields]);
          });
        });
      });
    }
  },
};
