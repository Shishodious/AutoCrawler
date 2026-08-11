/**
 * Express app factory — everything except listening/boot side effects,
 * so tests can exercise routes with supertest without opening ports.
 */
const env = require('./config/env');
const logger = require('./config/logger');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const passport = require('passport');

const app = express();

// Behind a proxy in production (Render/nginx) — needed for correct
// client IPs in rate limiting.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health'
    }
  })
);
app.use(passport.initialize());
require('./config/passport')(passport);

// Health check mounted BEFORE rate limiters — monitors must never be throttled.
app.use('/api/health', require('./routes/healthRoutes'));

// Global API rate limit + stricter limit on auth (brute-force protection).
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api', require('./routes/crawlRoutes'));

module.exports = app;
