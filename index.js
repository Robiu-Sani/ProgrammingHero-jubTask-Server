const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
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
    const users_collection = client
      .db("PayPathApplication")
      .collection("users");

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.status === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/users", async (req, res) => {
      const user = req.body;
      const { email } = req.body;
      const saltRounds = 10;

      try {
        user.password = await bcrypt.hash(user.password, saltRounds);
        const result = await users_collection.insertOne(user);
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });

        res.json({
          message: "User created successfully",
          email,
          result,
          token,
        });
      } catch (err) {
        console.error(err);
        res.status(500).send("Error hashing password");
      }
    });

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      try {
        const user = await users_collection.findOne({
          $or: [{ email: email }],
        });

        if (!user) {
          return res.status(400).send("User not found");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).send("Invalid password");
        }

        const token = jwt.sign({ email }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });

        res.json({ message: "Login successful", email, token });
      } catch (err) {
        console.error(err);
        res.status(500).send("Error logging in");
      }
    });

    app.get("/users", async (req, res) => {
      const result = await users_collection.find().toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Payment method root api");
});

// Listen on port
app.listen(port, () => {
  console.log(`Server port is ${port}`);
});
