const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '192.168.3.77',
  user: 'userming',
  password: 'Abc_123456',
  database: 'my_database'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL!');
});

module.exports = connection;
