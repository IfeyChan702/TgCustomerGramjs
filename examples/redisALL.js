const { createClient } = require("redis");

async function getAllRedisData() {
  const client = createClient({
    url: "redis://:test123456@192.168.3.77:44513" // Change this if needed
  });

  await client.connect();

  // Fetch all keys
  const keys = await client.keys("*");

  const result = {};
  for (const key of keys) {
    const type = await client.type(key); // Check the type of each key

    if (type === "string") {
      result[key] = await client.get(key); // Get string value
    } else if (type === "list") {
      result[key] = await client.lRange(key, 0, -1); // Get list elements
    } else if (type === "set") {
      result[key] = await client.sMembers(key); // Get set elements
    } else if (type === "hash") {
      result[key] = await client.hGetAll(key); // Get hash fields
    } else if (type === "zset") {
      result[key] = await client.zRange(key, 0, -1, { withScores: true }); // Get sorted set elements
    }
  }

  await client.disconnect();
  return result;
}

// Example usage:
getAllRedisData().then(data => console.log("Redis Data:", data));

// const { createClient } = require("redis");

async function clearRedisData() {
  const client = createClient({ url: "redis://localhost:6379" });

  await client.connect();

  await client.flushAll(); // Clears all Redis databases

  console.log("All Redis data deleted.");
  await client.disconnect();
}

// Example usage
// clearRedisData();
