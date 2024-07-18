const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173", // Your frontend URL
  })
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.541tyao.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const users_collection = client
      .db("PayPathApplication")
      .collection("users");

    // Register user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const { email } = req.body;
      const saltRounds = 10;

      try {
        user.password = await bcrypt.hash(user.password, saltRounds);
        const result = await users_collection.insertOne(user);

        res.json({
          message: "User created successfully",
          email,
          result,
        });
      } catch (err) {
        console.error(err);
        res.status(500).send("Error hashing password");
      }
    });

    // User login
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      try {
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

    // Get users
    app.get("/users", async (req, res) => {
      try {
        const result = await users_collection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching users");
      }
    });

    // Other routes...
  } finally {
    // Ensure the client will close when you finish/error
  }
}

run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Payment method root API");
});

// Listen on port
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
