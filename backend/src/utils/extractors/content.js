/**
 * Main-content extraction via Mozilla Readability.
 * Turns raw HTML into the readable article body + structure that both the
 * report layer and the LLM extractor consume. Headings/images are collected
 * before Readability.parse() (it mutates the DOM).
 */
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const MAX_TEXT = 50000; // cap persisted text; keeps documents bounded

function extractContent(html, url) {
  if (!html) return null;

  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
      .map((h) => ({ tag: h.tagName.toLowerCase(), text: (h.textContent || '').trim() }))
      .filter((h) => h.text)
      .slice(0, 50);

    const images = Array.from(doc.querySelectorAll('img[src]'))
      .map((img) => {
        try {
          return new URL(img.getAttribute('src'), url).href;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(0, 50);

    const article = new Readability(doc).parse();
    const text = (article?.textContent || '').trim();

    return {
      text: text.slice(0, MAX_TEXT),
      excerpt: article?.excerpt || '',
      author: article?.byline || '',
      siteName: article?.siteName || '',
      publishedTime: article?.publishedTime || '',
      wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
      headings,
      images
    };
  } catch {
    // Malformed HTML shouldn't fail the crawl — content is best-effort
    return null;
  }
}

module.exports = { extractContent };
