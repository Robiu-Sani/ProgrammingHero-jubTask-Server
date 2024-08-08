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

    const users_history = client
      .db("PayPathApplication")
      .collection("historys");

    const cash_in = client.db("PayPathApplication").collection("cashIn");

    const users_profile = client
      .db("PayPathApplication")
      .collection("profiles");

    //get request data data
    app.get("/cashIn", async (req, res) => {
      try {
        const result = await cash_in.find().toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching users");
      }
    });

    //add cashin post
    app.post(`/cashIn`, async (req, res) => {
      const data = req.body;
      const result = await cash_in.insertOne(data);
      res.send(result);
    });

    app.delete(`/removeCashIn/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cash_in.deleteOne(query);
      res.send(result);
    });

    app.delete(`/AddCashIn/:id`, async (req, res) => {
      try {
        const id = req.params.id;
        const senderEmail = req.body.email;
        const amountToAdd = parseInt(req.body.amount);

        // Validate the incoming request data
        if (!senderEmail || isNaN(amountToAdd)) {
          return res.status(400).send({ message: "Invalid request data" });
        }

        // Log the history of this request
        const history = await users_history.insertOne(req.body);
        if (!history.insertedId) {
          return res
            .status(500)
            .send({ message: "Failed to log request history" });
        }

        // Find the sender user by email
        const senderQuery = { email: senderEmail };
        const senderUser = await users_collection.findOne(senderQuery);
        if (!senderUser) {
          return res.status(404).send({ message: "Sender user not found" });
        }

        // Calculate the new balance for the sender
        const newSenderBalance = parseInt(senderUser.balance) + amountToAdd;

        // Update the sender's balance
        const updateSenderData = {
          $set: { balance: newSenderBalance },
        };
        const senderUpdateResult = await users_collection.updateOne(
          senderQuery,
          updateSenderData
        );

        if (senderUpdateResult.modifiedCount === 0) {
          return res
            .status(500)
            .send({ message: "Failed to update sender's balance" });
        }

        // Delete the cash-in record
        const query = { _id: new ObjectId(id) };
        const deleteResult = await cash_in.deleteOne(query);

        if (deleteResult.deletedCount === 0) {
          return res
            .status(500)
            .send({ message: "Failed to delete cash-in record" });
        }

        res.send({
          message: "Cash-in record deleted and balance updated successfully",
        });
      } catch (error) {
        console.error("Error deleting cash-in record:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

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

    //get history
    app.get("/history", async (req, res) => {
      const result = await users_history.find().toArray();
      res.send(result);
    });

    //get user by number
    app.get("/usernumber/:number", async (req, res) => {
      const number = req.params.number;
      const query = { number: number };
      const user = await users_collection.findOne(query);
      res.send(user);
    });

    //update user balance by number for send money
    app.patch("/sendMoney/:number", async (req, res) => {
      try {
        const number = req.params.number;
        const query = { number: number };
        const requestBalance = parseInt(req.body.amount);
        const senderEmail = req.body.email;

        // Find the recipient user by number
        const recipientUser = await users_collection.findOne(query);
        if (!recipientUser) {
          return res.status(404).send({ message: "Recipient user not found" });
        }

        // Find the sender user by email
        const senderQuery = { email: senderEmail };
        const senderUser = await users_collection.findOne(senderQuery);
        if (!senderUser) {
          return res.status(404).send({ message: "Sender user not found" });
        }

        // Check if the recipient and sender numbers are the same
        if (number === senderUser.number) {
          return res
            .status(400)
            .send({ message: "You cannot send money to your own number" });
        }

        ////for checking balance
        if (senderUser.balance < requestBalance) {
          return res
            .status(400)
            .send({ message: "You don't have mutch money to send." });
        }

        // Calculate the new balance for the recipient
        const newRecipientBalance =
          parseInt(recipientUser.balance) +
          (requestBalance - (requestBalance / 100) * 1.3);
        const updateRecipientData = {
          $set: { balance: newRecipientBalance },
        };

        // Calculate the new balance for the sender
        const newSenderBalance = parseInt(senderUser.balance) - requestBalance;
        const updateSenderData = {
          $set: { balance: newSenderBalance },
        };

        // Prepare transaction history data
        const transactionData = {
          ...req.body,
          prevBalance: senderUser.balance,
          currentBalance: newSenderBalance,
        };

        // Update the recipient's balance
        const recipientUpdateResult = await users_collection.updateOne(
          query,
          updateRecipientData
        );

        // Update the sender's balance
        const senderUpdateResult = await users_collection.updateOne(
          senderQuery,
          updateSenderData
        );

        // Insert the transaction history
        const transactionHistoryResult = await users_history.insertOne(
          transactionData
        );

        // Send the response with all update results
        res.send({
          message: "Transaction successful",
          recipientBalanceUpdate: recipientUpdateResult,
          senderBalanceUpdate: senderUpdateResult,
          transactionHistoryInsert: transactionHistoryResult,
        });
      } catch (error) {
        console.error("Error during transaction:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    //get user by email
    app.get("/useremail/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await users_collection.findOne(query);
      res.send(user);
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
