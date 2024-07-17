const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
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
    const users_collection = client
      .db("PayPathApplication")
      .collection("users");

    // Middleware to verify JWT token
    function verifyToken(req, res, next) {
      const token = req.cookies.token;

      if (!token) {
        return res.status(401).send("Access Denied");
      }

      try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
      } catch (err) {
        res.status(400).send("Invalid Token");
      }
    }

    // Generate JWT token
    function generateToken(user) {
      return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h", // Token expires in 1 hour
      });
    }

    // POST a new user with hashed password and generate token
    app.post("/users", async (req, res) => {
      const user = req.body;
      const saltRounds = 10;

      // Hash the password before storing it
      try {
        user.password = await bcrypt.hash(user.password, saltRounds);
        const result = await users_collection.insertOne(user);

        // Generate JWT token
        const token = generateToken(user);

        // Set the token in the cookies
        res.cookie("token", token, { httpOnly: true });

        res.json({ result, token });
      } catch (err) {
        console.error(err);
        res.status(500).send("Error hashing password");
      }
    });

    // POST login route to authenticate user and generate JWT
    app.post("/login", async (req, res) => {
      const { username, password } = req.body;
      console.log("Received login request for:", username); // Debugging statement

      try {
        // Find the user by email or mobile number
        const user = await users_collection.findOne({
          $or: [{ email: username }, { mobile: username }],
        });

        if (!user) {
          return res.status(400).send("User not found");
        }

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).send("Invalid password");
        }

        // Generate JWT token
        const token = generateToken(user);

        // Set the token in the cookies
        res.cookie("token", token, { httpOnly: true });

        // Send the token to the client
        res.json({ token });
      } catch (err) {
        console.error(err);
        res.status(500).send("Error logging in");
      }
    });

    // Apply verifyToken middleware to all routes below
    app.use(verifyToken);

    // GET all users (protected)
    app.get("/users", async (req, res) => {
      const result = await users_collection.find().toArray();
      res.send(result);
    });
  } finally {
    // No operation currently in the finally block
  }
}
run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Single building website API");
});

// Listen on port
app.listen(port, () => {
  console.log(`Server port is ${port}`);
});
