/**
 * Crawl worker entrypoint — a separate process from the API.
 * Consumes jobs from the crawl queue with capped concurrency so
 * Puppeteer never blocks (or OOMs) the API process.
 *
 * Run with: npm run worker
 */
const env = require('../config/env');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const connectCluster = require('../config/database');
const { createRedisConnection, getSharedConnection } = require('../config/redis');
const { CRAWL_QUEUE_NAME } = require('../queue/crawlQueue');
const { processCrawlJob } = require('./crawlProcessor');
const { closeSharedBrowser } = require('../utils/crawlerPuppeteer');

async function main() {
  await connectCluster();
  logger.info('✅ Worker connected to database');

  const worker = new Worker(CRAWL_QUEUE_NAME, processCrawlJob, {
    // Workers need a dedicated blocking connection
    connection: createRedisConnection(),
    concurrency: env.CRAWL_CONCURRENCY
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, type: job.name }, '[Worker] Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, type: job?.name, err: err.message },
      '[Worker] Job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, '[Worker] Worker error');
  });

  logger.info(
    `🛠️ Crawl worker started (queue: ${CRAWL_QUEUE_NAME}, concurrency: ${env.CRAWL_CONCURRENCY})`
  );

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down worker`);
    try {
      await worker.close();
      await closeSharedBrowser();
      await getSharedConnection().quit();
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err: err.message }, 'Error during worker shutdown');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err: err.message }, '❌ Worker failed to start');
  process.exit(1);
});
