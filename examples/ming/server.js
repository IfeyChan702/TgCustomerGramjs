const express = require("express");
const { storeApiDetails, getApiDetails } = require("./redis");
const { initializeTelegramSessionStep1, initializeTelegramSessionStep2 } = require("./mainFunction");
const app = express();
const PORT = 3000;

app.use(express.json()); // Middleware to parse JSON requests

// Mock database (Replace with real DB)
const users = [
  { username: "admin", password: "ant.design" }
  // { username: "Bob", password: "securepass" }
];

// Login Route
app.post("/login", (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;

  // Check credentials
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    res.json({ message: "success" });
  } else {
    res.status(401).json({ message: "Invalid username or password" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

//
// app.get("/", (req, res) => {
//   res.send("Welcome to My API!");
// });
//
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
//
// app.get("/users", (req, res) => {
//   res.json([{ id: 1, name: "AliceX" }, { id: 2, name: "Bob" }]);
// });
//
// const axios = require("axios");
app.post("/ApiDetails", async (req, res) => {
  console.log("Received request body:", req.body);

  // Extract required parameters
  const { phone, apiId, apiHash,apiSession } = req.body;

  // Validate input
  if (!phone || !apiId || !apiHash) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    // Call the Redis function to store data
    await storeApiDetails(phone, apiId, apiHash,apiSession);

    await initializeTelegramSessionStep1(apiId, apiHash, phone);

    res.status(201).json({ message: "Data stored successfully. Please prepare phoneCode. ", phone, apiId, apiHash ,apiSession});
    const userData = await getApiDetails(phone);
    if (Object.keys(userData).length === 0) {
      return res.status(404).json({ message: "No data found for this phone number" });
    }

    // Send userData directly in response
    // res.status(200).json(userData);
  } catch (error) {
    console.error("Error storing data in Redis:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.post("/PhoneCode", async (req, res) => {
  console.log("Received request body:", req.body);

  // Extract required parameters
  const { phone, apiId, apiHash,phoneCode } = req.body;

  // Validate input
  if (!phone || !apiId || !apiHash || !phoneCode) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    // Call the Redis function to store data
    const sessionString = await initializeTelegramSessionStep2(apiId, apiHash, phoneNumber, phoneCode);
    // Forward details to main.ts via API call
    // await axios.post("http://localhost:4000/startTelegram", { phone, apiId, apiHash });

    res.status(201).json({ message: "Data stored successfully", sessionString});

    // Send userData directly in response
    // res.status(200).json(userData);
  } catch (error) {
    console.error("Error storing data in Redis:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});





app.get("/getApiDetails/:phone", async (req, res) => {
  const { phone } = req.params;

  try {
    const userData = await getApiDetails(phone);

    if (!userData || Object.keys(userData).length === 0) {
      return res.status(404).json({ message: "No data found for this phone number" });
    }

    res.status(200).json(userData); // Return apiId & apiHash
  } catch (error) {
    console.error("Error retrieving data from Redis:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//
// app.get("/ApiDetails", (req, res) => {
//   res.send("Success!");
// });