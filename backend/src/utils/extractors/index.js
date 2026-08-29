/**
 * Extraction pipeline — runs content + structured-data extraction over raw
 * HTML. Called at the intelligentCrawl boundary so every crawl (single or
 * recursive page) yields `content` and `structured` alongside links/metadata.
 */
const { extractContent } = require('./content');
const { extractStructuredData } = require('./structuredData');

function runExtractionPipeline(rawHtml, url) {
  return {
    content: extractContent(rawHtml, url),
    structured: extractStructuredData(rawHtml, url)
  };
}

module.exports = { runExtractionPipeline, extractContent, extractStructuredData };
