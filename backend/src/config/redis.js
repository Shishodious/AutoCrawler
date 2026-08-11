/**
 * Redis connection factory.
 * - getSharedConnection(): lazy singleton for BullMQ queues, health checks
 *   and publishing (safe to share — never used in subscriber mode).
 * - createRedisConnection(): dedicated connection, required for BullMQ
 *   Workers and pub/sub subscribers which take over the connection.
 */
const IORedis = require('ioredis');
const env = require('./env');

// Channel the worker publishes crawl progress events on; the API process
// subscribes and relays them to the right Socket.IO client.
const CRAWL_EVENTS_CHANNEL = 'crawl:events';

function createRedisConnection(overrides = {}) {
  return new IORedis(env.REDIS_URL, {
    // BullMQ requires maxRetriesPerRequest: null
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...overrides
  });
}

let sharedConnection = null;

function getSharedConnection() {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
}

module.exports = {
  createRedisConnection,
  getSharedConnection,
  CRAWL_EVENTS_CHANNEL
};
