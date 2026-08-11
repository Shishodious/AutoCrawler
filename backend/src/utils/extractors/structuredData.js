/**
 * Structured-data parser: pulls the machine-readable data sites already embed
 * — JSON-LD (schema.org), OpenGraph, and Twitter cards. This is the cheapest,
 * cleanest source of entities (Product, Article, Person, Organization…).
 */
const cheerio = require('cheerio');

/** Walk a JSON-LD node tree and collect {type, name} for each typed entity. */
function collectEntities(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectEntities(n, out));
    return;
  }
  if (node['@type']) {
    const type = Array.isArray(node['@type']) ? node['@type'].join(', ') : node['@type'];
    out.push({ type, name: node.name || node.headline || node.title || null });
  }
  if (node['@graph']) collectEntities(node['@graph'], out);
}

function extractStructuredData(html, url) {
  if (!html) return null;

  const $ = cheerio.load(html);

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      // skip malformed JSON-LD blocks
    }
  });

  const openGraph = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) openGraph[prop] = content;
  });

  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) twitter[name] = content;
  });

  const entities = [];
  jsonLd.forEach((node) => collectEntities(node, entities));

  const hasAny =
    jsonLd.length > 0 ||
    Object.keys(openGraph).length > 0 ||
    Object.keys(twitter).length > 0;

  if (!hasAny) return null;

  return {
    jsonLd: jsonLd.slice(0, 20),
    openGraph,
    twitter,
    entities: entities.slice(0, 50)
  };
}

module.exports = { extractStructuredData };
