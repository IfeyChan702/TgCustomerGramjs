const connection = require("./db");

const createTableQuery = `

CREATE TABLE IF NOT EXISTS  tg_groups (
                           id BIGINT PRIMARY KEY AUTO_INCREMENT,
                           tg_account_id BIGINT NOT NULL,
                           group_id BIGINT NOT NULL,
                           group_name VARCHAR(255) NOT NULL,
                           role ENUM('merchant', 'channel') NOT NULL,
                           template_id BIGINT NOT NULL
);

`;

connection.query(createTableQuery, (err, result) => {
  if (err) {
    console.error("Error creating table:", err);
  } else {
    console.log("Table created successfully!");
  }
});

connection.end();
