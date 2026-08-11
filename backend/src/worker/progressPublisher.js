/**
 * Progress publisher (worker side).
 * Same signature as socketService.emitCrawlEvent so the crawlers'
 * emitEvent option works unchanged — but publishes to Redis instead of
 * emitting directly, since Socket.IO lives in the API process.
 */
const { getSharedConnection, CRAWL_EVENTS_CHANNEL } = require('../config/redis');
const logger = require('../config/logger');

const publishCrawlEvent = (eventName, data, socketId = null) => {
  if (!socketId) return; // API-only mode: no client to notify

  getSharedConnection()
    .publish(CRAWL_EVENTS_CHANNEL, JSON.stringify({ eventName, data, socketId }))
    .catch((err) => {
      logger.warn({ err: err.message, eventName }, '[Worker] Failed to publish crawl event');
    });
};

module.exports = { publishCrawlEvent };
