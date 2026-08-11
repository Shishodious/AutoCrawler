/**
 * Crawl job queue (BullMQ).
 * The API enqueues jobs here; the worker process (src/worker) consumes them.
 * Job name = crawl type: 'single' | 'recursive'.
 * Job data: { url, options, userId, socketId }
 */
const { Queue } = require('bullmq');
const { getSharedConnection } = require('../config/redis');

const CRAWL_QUEUE_NAME = 'crawl';

let queue = null;

function getCrawlQueue() {
  if (!queue) {
    queue = new Queue(CRAWL_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        // Keep finished jobs long enough for the frontend to poll results
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 }
      }
    });
  }
  return queue;
}

/**
 * @param {'single'|'recursive'} type
 * @param {{url: string, options: Object, userId: string|null, socketId: string|null}} payload
 */
async function enqueueCrawlJob(type, payload) {
  return getCrawlQueue().add(type, payload);
}

module.exports = {
  CRAWL_QUEUE_NAME,
  getCrawlQueue,
  enqueueCrawlJob
};
