/**
 * Proxy pool (round-robin).
 * Configured via PROXY_URLS (comma-separated). Rotates per request so a single
 * target sees traffic spread across egress IPs. Empty config = direct.
 */
const env = require('./../config/env');

const proxies = (env.PROXY_URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let cursor = 0;

function nextProxy() {
  if (proxies.length === 0) return null;
  const proxy = proxies[cursor % proxies.length];
  cursor += 1;
  return proxy;
}

function hasProxies() {
  return proxies.length > 0;
}

module.exports = { nextProxy, hasProxies };
