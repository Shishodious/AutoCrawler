/**
 * robots.txt compliance.
 * Fetches and caches each host's robots.txt and answers "may we crawl this
 * URL?". Respected by default; a caller may override only for domains the user
 * is authorized to crawl (see the AUP gate on the crawl routes). Failing open
 * (allow) on fetch errors matches standard crawler behavior — absence of a
 * robots.txt means no restriction.
 */
const axios = require('axios');
const robotsParser = require('robots-parser');
const env = require('./../config/env');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map(); // host → { parser, expires }

const BOT_UA = env.CRAWLER_USER_AGENT || 'AutoCrawlerBot';

async function getRobots(origin) {
  const cached = cache.get(origin);
  if (cached && cached.expires > Date.now()) return cached.parser;

  const robotsUrl = `${origin}/robots.txt`;
  let parser;
  try {
    const res = await axios.get(robotsUrl, {
      timeout: 8000,
      maxRedirects: 3,
      // 4xx means "no rules"; only 2xx bodies carry directives
      validateStatus: (s) => s < 500,
      headers: { 'User-Agent': BOT_UA }
    });
    const body = res.status >= 200 && res.status < 300 ? res.data : '';
    parser = robotsParser(robotsUrl, typeof body === 'string' ? body : '');
  } catch {
    // Network error / no robots.txt → treat as unrestricted
    parser = robotsParser(robotsUrl, '');
  }

  cache.set(origin, { parser, expires: Date.now() + CACHE_TTL_MS });
  return parser;
}

/**
 * @returns {Promise<{allowed: boolean, reason: string|null}>}
 */
async function checkRobots(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return { allowed: true, reason: null };
  }
  const parser = await getRobots(origin);
  const allowed = parser.isAllowed(url, BOT_UA);
  // robots-parser returns undefined when there is no matching rule → allowed
  if (allowed === false) {
    return { allowed: false, reason: `Disallowed by robots.txt for ${BOT_UA}` };
  }
  return { allowed: true, reason: null };
}

module.exports = { checkRobots, BOT_UA };
