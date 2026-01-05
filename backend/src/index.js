require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectCluster = require("./config/database");
const { initializeSocket } = require('./services/socketService');

const app = express();

const passport = require('passport');

// Middleware
app.use(cors({
  origin: "http://localhost:5173"
}));
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
    
    // Your existing code - this returns an HTTP server
    const server = app.listen(process.env.PORT || 5000, () => {
      console.log(
        `🚀 Server successfully listening on port ${process.env.PORT || 5000}`
      );
    });
    
    // Initialize Socket.IO with authentication
    initializeSocket(server);
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }); 