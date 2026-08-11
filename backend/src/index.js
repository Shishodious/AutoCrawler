const env = require('./config/env');
const logger = require('./config/logger');
const app = require('./app');
const connectCluster = require('./config/database');
const { initializeSocket } = require('./services/socketService');
const { startProgressRelay } = require('./services/progressRelay');

connectCluster()
  .then(() => {
    logger.info('✅ Database connection established');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 API listening on port ${env.PORT}`);
    });

    // Socket.IO for real-time crawl progress, fed by the worker via Redis pub/sub
    initializeSocket(server);
    startProgressRelay();

    const shutdown = (signal) => {
      logger.info(`${signal} received, shutting down`);
      server.close(() => process.exit(0));
      // Force-exit if connections refuse to drain
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    logger.error({ err: err.message }, '❌ Database connection failed');
    process.exit(1);
  });
