/**
 * Per-host politeness throttle (Redis-backed).
 * Enforces a minimum interval between requests to the same host across ALL
 * worker processes, so parallel crawls never hammer a single target. Uses a
 * Redis Lua script for a race-free "next allowed time" reservation and returns
 * the number of ms the caller should wait before proceeding.
 */
const { getSharedConnection } = require('../config/redis');
const env = require('./../config/env');

const MIN_INTERVAL_MS = env.CRAWL_MIN_HOST_INTERVAL_MS || 1000;

// Reserve the next slot for this host. Returns ms to wait (0 if free now).
const RESERVE_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local next = tonumber(redis.call('get', key) or '0')
if now >= next then
  redis.call('set', key, now + interval, 'PX', interval * 4)
  return 0
else
  redis.call('set', key, next + interval, 'PX', (next - now) + interval * 4)
  return next - now
end
`;

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Block until it's polite to hit this host, then return.
 * @param {string} url
 * @param {number} [nowMs] - injectable clock for tests
 */
async function throttleHost(url, nowMs = Date.now()) {
  const host = hostOf(url);
  if (!host) return 0;

  const redis = getSharedConnection();
  let waitMs = 0;
  try {
    waitMs = await redis.eval(RESERVE_SCRIPT, 1, `throttle:${host}`, String(nowMs), String(MIN_INTERVAL_MS));
    waitMs = Number(waitMs) || 0;
  } catch {
    // If Redis is unavailable, don't block crawling — throttle is best-effort
    return 0;
  }

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return waitMs;
}

module.exports = { throttleHost, MIN_INTERVAL_MS };
