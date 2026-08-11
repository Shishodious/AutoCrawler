/**
 * Progress relay (API side).
 * The worker runs in a separate process and can't reach this process's
 * Socket.IO instance, so it publishes crawl events to Redis; this relay
 * subscribes and forwards each event to the target client socket.
 */
const { createRedisConnection, CRAWL_EVENTS_CHANNEL } = require('../config/redis');
const { emitCrawlEvent } = require('./socketService');
const logger = require('../config/logger');

let subscriber = null;

function startProgressRelay() {
  if (subscriber) return subscriber;

  // Dedicated connection: a subscribed Redis connection can't run other commands
  subscriber = createRedisConnection();

  subscriber.subscribe(CRAWL_EVENTS_CHANNEL, (err) => {
    if (err) {
      logger.error({ err: err.message }, '[Relay] Failed to subscribe to crawl events');
      return;
    }
    logger.info(`[Relay] Subscribed to ${CRAWL_EVENTS_CHANNEL}`);
  });

  subscriber.on('message', (channel, message) => {
    if (channel !== CRAWL_EVENTS_CHANNEL) return;
    try {
      const { eventName, data, socketId } = JSON.parse(message);
      if (eventName && socketId) {
        emitCrawlEvent(eventName, data, socketId);
      }
    } catch (err) {
      logger.warn({ err: err.message }, '[Relay] Dropped malformed crawl event');
    }
  });

  return subscriber;
}

module.exports = { startProgressRelay };
