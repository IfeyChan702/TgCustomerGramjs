const dbService = require('../services/dbService');

async function fetchGroups(req, res) {
  try {
    const groups = await dbService.getAllGroups();
    console.log("Query Result:", groups); // This prints the query result in the console
    // res.json(groups); // Sends the result as JSON response
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: 'Database query failed' });
  }
}
fetchGroups();