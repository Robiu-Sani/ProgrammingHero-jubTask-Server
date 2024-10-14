const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let cachedClient = null;
let cachedDb = null;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.541tyao.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  console.log("Connected to MongoDB successfully");
  const db = client.db("PayPathApplication");

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Cash In - Get All
app.get("/cashIn", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const cash_in = db.collection("cashIn");
    const result = await cash_in.find().toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

// Cash In - Add New
app.post("/cashIn", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const cash_in = db.collection("cashIn");
    const data = req.body;
    const result = await cash_in.insertOne(data);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding cash-in");
  }
});

// Cash In - Remove
app.delete("/removeCashIn/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const cash_in = db.collection("cashIn");
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await cash_in.deleteOne(query);
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing cash-in");
  }
});

// Cash In - Add Amount and Update Balance
app.post("/AddCashIn/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const users_history = db.collection("historys");
    const cash_in = db.collection("cashIn");

    const id = req.params.id;
    const senderEmail = req.body[0].email;
    const amountToAdd = parseInt(req.body[0].amount);

    const history = await users_history.insertOne(req.body[0]);
    const senderQuery = { email: senderEmail };
    const senderUser = await users_collection.findOne(senderQuery);

    const newSenderBalance = parseInt(senderUser.balance) + amountToAdd;
    const updateSenderData = { $set: { balance: newSenderBalance } };

    const senderUpdateResult = await users_collection.updateOne(
      senderQuery,
      updateSenderData
    );

    const query = { _id: new ObjectId(id) };
    const deleteResult = await cash_in.deleteOne(query);

    res.send({
      message: "Cash-in record deleted and balance updated successfully",
      senderUpdateResult,
      deleteResult,
      history,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing cash-in");
  }
});

// User Registration
app.post("/users", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const user = req.body;
    const { email } = req.body;
    const saltRounds = 10;

    user.password = await bcrypt.hash(user.password, saltRounds);
    const result = await users_collection.insertOne(user);

    res.json({
      message: "User created successfully",
      email,
      result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registering user");
  }
});

// User Login
app.post("/login", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const { email, password } = req.body;

    const user = await users_collection.findOne({ email });
    if (!user) {
      return res.status(400).send("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send("Invalid password");
    }

    res.json({ message: "success", email });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging in");
  }
});

// Get All Users
app.get("/users", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const result = await users_collection.find().toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

// Get All Users
app.get("/useremail/:email", async (req, res) => {
  try {
    // Connect to the database
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");

    // Extract the email from the request parameters
    const { email } = req.params;

    // Find the user by email in the database
    const result = await users_collection.findOne({ email: email });

    // If no user is found, send a 404 status
    if (!result) {
      return res.status(404).send("User not found");
    }

    // Send the user data as a response
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching user");
  }
});

// Delete User
app.delete("/users/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const result = await users_collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({ message: "User deleted successfully", result });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// Update User Status to Agent
app.patch("/users/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const updateData = { $set: { status: "agent" } };

    const result = await users_collection.updateOne(query, updateData);

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({
      message: "User status updated to agent successfully",
      result,
    });
  } catch (err) {
    console.error("Error updating user status:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// Get User Transaction History
app.get("/history", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_history = db.collection("historys");
    const result = await users_history.find().toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching history");
  }
});

// Get User by Phone Number
app.get("/usernumber/:number", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const number = req.params.number;
    const query = { number: number };
    const user = await users_collection.findOne(query);
    res.send(user);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching user by number");
  }
});

// Send Money and Update Balances
app.patch("/sendMoney/:number", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users_collection = db.collection("users");
    const users_history = db.collection("historys");

    const number = req.params.number;
    const query = { number: number };
    const requestBalance = parseInt(req.body.amount);
    const senderEmail = req.body.email;

    const recipientUser = await users_collection.findOne(query);
    if (!recipientUser) {
      return res.status(404).send({ message: "Recipient user not found" });
    }

    const senderQuery = { email: senderEmail };
    const senderUser = await users_collection.findOne(senderQuery);
    if (!senderUser) {
      return res.status(404).send({ message: "Sender user not found" });
    }

    if (number === senderUser.number) {
      return res
        .status(400)
        .send({ message: "You cannot send money to your own number" });
    }

    if (senderUser.balance < requestBalance) {
      return res.status(400).send({ message: "Insufficient balance" });
    }

    const newRecipientBalance =
      parseInt(recipientUser.balance) +
      (requestBalance - (requestBalance / 100) * 1.85);
    const newSenderBalance = senderUser.balance - requestBalance;

    const updateRecipientData = { $set: { balance: newRecipientBalance } };
    const updateSenderData = { $set: { balance: newSenderBalance } };

    const recipientUpdateResult = await users_collection.updateOne(
      query,
      updateRecipientData
    );

    const senderUpdateResult = await users_collection.updateOne(
      senderQuery,
      updateSenderData
    );

    const transactionHistoryResult = await users_history.insertOne(req.body);

    res.send({
      message: "Money sent successfully",
      recipientBalanceUpdate: recipientUpdateResult,
      senderBalanceUpdate: senderUpdateResult,
      transactionHistory: transactionHistoryResult,
    });
  } catch (err) {
    console.error("Error processing transaction:", err);
    res.status(500).send({ message: "Server error" });
  }
});

// Default Route
app.get("/", (req, res) => {
  res.send("Payment method root API");
});

// Test Route
app.get("/test", (req, res) => {
  res.send("API is working!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
