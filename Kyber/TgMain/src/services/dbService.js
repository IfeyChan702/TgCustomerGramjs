const connection = require('../models/db');

async function getAllGroups() {
  return new Promise((resolve, reject) => {
    connection.query('SELECT * FROM tg_groups', (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function getGroupById(groupId) {
  return new Promise((resolve, reject) => {
    connection.query('SELECT * FROM tg_groups WHERE id = ?', [groupId], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
}

module.exports = { getAllGroups, getGroupById };
