const express = require("express");
const { createClient } = require("redis");

const app = express();
const PORT = 3000;

// Middleware to parse JSON request body
app.use(express.json());

// Initialize Redis client
const client = createClient({
  url: "redis://:test123456@192.168.3.77:44513" // Update this as needed
});

client.on("error", (err) => console.error("Redis Client Error", err));

async function getAllHashes() {
  await client.connect(); // Connect to Redis

  const keys = await client.keys("*"); // Get all keys
  const result = {};

  for (const key of keys) {
    const type = await client.type(key); // Check type of key
    if (type === "hash") {
      result[key] = await client.hGetAll(key); // Get hash values
    }
  }

  await client.disconnect(); // Disconnect after fetching data
  return result;
}

async function deleteRedisHash(hashKey) {
  await client.connect();

  const exists = await client.exists(hashKey); // Check if the key exists
  if (!exists) {
    await client.disconnect();
    return { success: false, message: `Key '${hashKey}' not found` };
  }

  await client.del(hashKey); // Delete the hash key
  await client.disconnect();

  return { success: true, message: `Key '${hashKey}' deleted successfully` };
}

// Function to update Redis hash
async function updateRedisHash(hashKey, updateData) {
  await client.connect();

  const exists = await client.exists(hashKey); // Check if the key exists
  if (!exists) {
    await client.disconnect();
    return { success: false, message: `Key '${hashKey}' not found` };
  }

  await client.hSet(hashKey, updateData); // Update the hash fields
  await client.disconnect();

  return { success: true, message: `Key '${hashKey}' updated successfully` };
}

// Function to insert a new Redis hash with a provided UUID
async function insertRedisHash(uuid, newData) {
  await client.connect();

  const hashKey = `tg:register:${uuid}`; // Construct the Redis key

  await client.hSet(hashKey, newData); // Store the new hash data
  await client.disconnect();

  return { success: true, message: `New hash stored with key '${hashKey}'`, registerId: hashKey };
}


// API Endpoint to fetch all hashes
app.get("/getAllHashes", async (req, res) => {
  try {
    const hashes = await getAllHashes();
    res.json(hashes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Endpoint to delete a hash by key using request body
app.delete("/deleteHashes", async (req, res) => {
  try {
    const { registerId } = req.body; // Extract hash key from request body
    if (!registerId) {
      return res.status(400).json({ error: "registerId is required in the request body." });
    }

    const result = await deleteRedisHash(registerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// API Endpoint to update Redis hash
app.put("/updateHash", async (req, res) => {
  try {
    const { registerId, session, apiId, apiHash, phone, status, code } = req.body;

    if (!registerId) {
      return res.status(400).json({ error: "registerId is required in the request body." });
    }

    const updateData = {};
    if (session) updateData["session"] = session;
    if (apiId) updateData["apiId"] = apiId;
    if (apiHash) updateData["apiHash"] = apiHash;
    if (phone) updateData["phone"] = phone;
    if (status) updateData["status"] = status;
    if (code) updateData["code"] = code;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "At least one field to update must be provided." });
    }

    const result = await updateRedisHash(registerId, updateData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Endpoint to insert a new Redis hash
app.post("/insertHash", async (req, res) => {
  try {
    const { uuid, session, apiId, apiHash, phone, status, code } = req.body;

    if (!uuid  || !apiId || !apiHash ) {
      return res.status(400).json({ error: "uuid, apiId, apiHash are required." });
    }

    const newData = {};
    if (session) newData["session"] = session;
    if (apiId) newData["apiId"] = apiId;
    if (apiHash) newData["apiHash"] = apiHash;
    if (phone) newData["phone"] = phone;
    if (status) newData["status"] = status;
    if (code) newData["code"] = code;

    if (Object.keys(newData).length === 0) {
      return res.status(400).json({ error: "At least one field must be provided for insertion." });
    }

    const result = await insertRedisHash(uuid, newData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
