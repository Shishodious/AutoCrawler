/**
 * Deterministic, selector-based extraction.
 * Given a map of { fieldName: cssSelector } (selector may carry an
 * "@attribute" suffix, e.g. "a.link@href"), pull typed values out of the HTML
 * with Cheerio. A selector that matches multiple elements returns an array.
 */
const cheerio = require('cheerio');

function readValue($, el, attr) {
  if (attr) {
    return ($(el).attr(attr) || '').trim();
  }
  return $(el).text().trim();
}

/**
 * @param {string} html - raw HTML
 * @param {Object<string,string>} selectors - field → CSS selector (+ optional @attr)
 * @returns {Object} field → string | string[]
 */
function extractWithSelectors(html, selectors) {
  const $ = cheerio.load(html || '');
  const result = {};

  for (const [field, rawSelector] of Object.entries(selectors || {})) {
    if (!rawSelector) {
      result[field] = null;
      continue;
    }
    const atIdx = rawSelector.lastIndexOf('@');
    const selector = atIdx > 0 ? rawSelector.slice(0, atIdx).trim() : rawSelector.trim();
    const attr = atIdx > 0 ? rawSelector.slice(atIdx + 1).trim() : null;

    let matched;
    try {
      matched = $(selector);
    } catch {
      result[field] = null; // invalid selector → null, don't crash the job
      continue;
    }

    if (matched.length === 0) {
      result[field] = null;
    } else if (matched.length === 1) {
      result[field] = readValue($, matched[0], attr);
    } else {
      result[field] = matched
        .toArray()
        .map((el) => readValue($, el, attr))
        .filter(Boolean);
    }
  }

  return result;
}

module.exports = { extractWithSelectors };
