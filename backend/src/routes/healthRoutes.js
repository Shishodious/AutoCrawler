const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getSharedConnection } = require('../config/redis');

// GET /api/health — real dependency check (Mongo + Redis).
// Returns 503 when any dependency is down so load balancers/uptime
// monitors see the truth instead of a hardcoded "Connected".
router.get('/', async (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;

  let redisConnected = false;
  try {
    const pong = await Promise.race([
      getSharedConnection().ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timeout')), 1000)
      )
    ]);
    redisConnected = pong === 'PONG';
  } catch {
    redisConnected = false;
  }

  const healthy = dbConnected && redisConnected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime())
  });
});

module.exports = router;
