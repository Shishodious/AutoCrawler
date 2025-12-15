require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectCluster = require("./config/database");

const app = express();

const passport = require('passport');

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Passport Config
require('./config/passport')(passport);

// Test route
app.get("/api/health", (req, res) => {
  res.json({ status: "Server running", database: "Connected" });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/crawlRoutes'));

connectCluster()
  .then(() => {
    console.log("✅ Database connection established");
    app.listen(process.env.PORT || 5000, () => {
      console.log(
        `🚀 Server successfully listening on port ${process.env.PORT || 5000}`
      );
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1); // Exit process if DB connection fails
  });
