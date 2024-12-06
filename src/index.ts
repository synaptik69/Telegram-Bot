import express from "express";
import dotenv from "dotenv";
import sequelize from "./config/database"; // Your Sequelize database config
import User from "./models/userModel"; // Your User
import Bet from "./models/betModel";
import Vote from "./models/voteModel";
import Wager from "./models/wagerModel";

import bot from "./services/telegramBot"; // Your Telegram bot setup
import userRouter from "./routes/users"; // Importing the userRouter

dotenv.config(); // Load environment variables
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Middleware to parse JSON body
app.use("/api/users", userRouter); // Register user routes under /api/users

// Route to test database connection
// app.get("/", async (req, res) => {
//   try {
//     // Sync models with the database (creates the 'users' table if it doesn't exist)
//     //await sequelize.sync();
//     res.send("Database connected and tables synced!");
//   } catch (error) {
//     console.error("Database connection failed:", error);
//     res.status(500).send("Database connection failed");
//   }
// });

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  await sequelize.sync();
});

// Start the Telegram bot in the background
bot.startPolling();
