/**
 * Crawl job processor — runs in the worker process.
 * The bodies of the old POST /api/crawl and POST /api/crawl/recursive
 * handlers, moved out of the request cycle. Return values become the
 * BullMQ job result, served to the frontend by GET /api/crawl/jobs/:jobId.
 */
const mongoose = require('mongoose');
const SiteData = require('../models/SiteData');
const { intelligentCrawl, recursiveCrawl } = require('../utils/hybridCrawler');
const { createSiteDataSchema } = require('../utils/validation');
const { triggerSingleCrawl, triggerRecursiveCrawl } = require('../utils/n8nTrigger');
const { extractWithSelectors } = require('../utils/extractors/selectorExtractor');
const { extractWithLlm, isLlmAvailable } = require('../utils/extractors/llmExtractor');
const AuthSession = require('../models/AuthSession');
const { decrypt } = require('../utils/crypto');
const { publishCrawlEvent } = require('./progressPublisher');
const logger = require('../config/logger');

/**
 * Resolve AUP-gated access overrides. robots.txt is respected unless the caller
 * is explicitly authorized AND asked to override; an authorized session cookie
 * is decrypted only for its owner. Returns { authCookies?, respectRobots }.
 */
async function resolveAccessOptions(options = {}, userId) {
  const authorized = options.authorized === true;
  // Only an authorized request may disable robots; everyone else respects it.
  const respectRobots = !(authorized && options.respectRobots === false);

  let authCookies;
  if (authorized && options.authSessionId && userId) {
    try {
      const session = await AuthSession.findOne({ _id: options.authSessionId, userId }).select('+encryptedCookies');
      if (session) authCookies = decrypt(session.encryptedCookies);
    } catch (err) {
      logger.warn({ err: err.message }, '[Worker] Failed to load/decrypt auth session');
    }
  }
  return { authCookies, respectRobots };
}

/** Throw an error that carries the crawl error type for the job's failedReason */
function crawlError(type, message) {
  const err = new Error(`${type}: ${message}`);
  err.errorType = type;
  return err;
}

async function runSingleCrawl({ url, options = {}, userId = null, socketId = null }) {
  logger.info({ url, socketId }, '[Worker] Starting single crawl');

  const access = await resolveAccessOptions(options, userId);
  const crawlResult = await intelligentCrawl(url, {
    ...options,
    ...access,
    verbose: true,
    socketId,
    emitEvent: publishCrawlEvent
  });

  if (!crawlResult.success) {
    throw crawlError(
      crawlResult.error?.type || 'UNKNOWN',
      crawlResult.error?.message || 'Unknown error occurred'
    );
  }

  const siteDataPayload = {
    url: crawlResult.url || url,
    title: crawlResult.title || 'Untitled',
    links: crawlResult.links || [],
    metadata: {
      description: crawlResult.metadata?.description || '',
      keywords: crawlResult.metadata?.keywords || [],
      author: crawlResult.metadata?.author || '',
      ogImage: crawlResult.metadata?.ogImage || '',
      favicon: crawlResult.metadata?.favicon || '',
      language: crawlResult.metadata?.language || '',
      contentType: crawlResult.metadata?.contentType || 'text/html'
    },
    content: crawlResult.pageContent || undefined,
    structured: crawlResult.structured || undefined,
    crawlerStats: {
      method: crawlResult.method,
      duration: crawlResult.duration,
      depth: options.maxDepth || 0,
      statusCode: crawlResult.statusCode || 200,
      responseSize: crawlResult.responseSize || 0
    },
    sslInfo: {
      protocol: url.startsWith('https') ? 'https' : 'http',
      tlsVersion: crawlResult.tlsVersion || 'N/A',
      certificateValid: crawlResult.certificateValid || null
    },
    blockState: crawlResult.block?.state || 'OK',
    // A detected block is not a successful crawl — record why
    crawlSuccess: !crawlResult.block?.blocked,
    ...(crawlResult.block?.blocked
      ? { errorType: crawlResult.block.state, errorMessage: crawlResult.block.reason }
      : {})
  };

  if (userId) {
    siteDataPayload.userId = userId;
  }

  const dataValidation = createSiteDataSchema.safeParse(siteDataPayload);

  if (!dataValidation.success) {
    logger.warn({ url }, '[Worker] Data validation failed, saving minimal data');
    const minimalData = {
      url,
      title: crawlResult.title || 'Untitled',
      links: crawlResult.links || [],
      crawlerStats: {
        method: crawlResult.method,
        duration: crawlResult.duration,
        depth: 0
      },
      sslInfo: {
        protocol: url.startsWith('https') ? 'https' : 'http'
      }
    };
    if (userId) minimalData.userId = userId;

    const siteData = new SiteData(minimalData);
    await siteData.save();

    return {
      success: true,
      message: 'Crawl completed (partial data saved)',
      data: siteData,
      warning: 'Some metadata could not be validated'
    };
  }

  const siteData = new SiteData(dataValidation.data);
  await siteData.save();

  logger.info({ url, id: siteData._id.toString() }, '[Worker] Saved crawl data');

  // Trigger n8n webhook (non-blocking)
  triggerSingleCrawl({ url, crawlResult, siteData });

  const blocked = Boolean(crawlResult.block?.blocked);

  return {
    success: true,
    message: blocked
      ? `Crawl reached the page but it was ${crawlResult.block.state} (${crawlResult.block.reason})`
      : 'Crawl completed successfully',
    data: {
      id: siteData._id,
      url: siteData.url,
      title: siteData.title,
      links: siteData.links,
      metadata: siteData.metadata,
      content: siteData.content,
      structured: siteData.structured,
      crawlerStats: siteData.crawlerStats,
      sslInfo: siteData.sslInfo,
      detectionInfo: {
        reason: crawlResult.detectionReason || 'N/A',
        confidence: crawlResult.confidence || 0,
        framework: crawlResult.framework || null
      },
      // Access outcome — surfaced so a blocked page never reads as a clean crawl
      blockState: siteData.blockState,
      blockReason: crawlResult.block?.reason || null,
      errorType: siteData.errorType,
      crawlSuccess: siteData.crawlSuccess,
      crawledAt: siteData.createdAt
    }
  };
}

async function runRecursiveCrawl({ url, options = {}, userId = null, socketId = null }) {
  logger.info(
    { url, maxDepth: options.maxDepth, maxPages: options.maxPages },
    '[Worker] Starting recursive crawl'
  );
  const startTime = Date.now();

  const crawlResult = await recursiveCrawl(url, {
    ...options,
    verbose: true,
    socketId,
    emitEvent: publishCrawlEvent
  });

  if (!crawlResult.success) {
    throw crawlError('UNKNOWN', 'Recursive crawl did not complete successfully');
  }

  // Group all pages of this crawl under one session
  const crawlSessionId = new mongoose.Types.ObjectId();

  const savedPages = [];
  const failedPages = [];

  for (const pageResult of crawlResult.results) {
    try {
      if (pageResult.success) {
        const siteDataPayload = {
          url: pageResult.url || url,
          title: pageResult.title || 'Untitled',
          links: pageResult.links || [],
          metadata: {
            description: pageResult.metadata?.description || pageResult.description || '',
            keywords: pageResult.metadata?.keywords || [],
            author: pageResult.metadata?.author || '',
            ogImage: pageResult.metadata?.ogImage || '',
            favicon: pageResult.metadata?.favicon || '',
            language: pageResult.metadata?.language || '',
            contentType: pageResult.metadata?.contentType || 'text/html'
          },
          content: pageResult.pageContent || undefined,
          structured: pageResult.structured || undefined,
          crawlerStats: {
            method: pageResult.method,
            duration: pageResult.duration,
            depth: pageResult.depth,
            statusCode: pageResult.statusCode || 200,
            responseSize: pageResult.responseSize || 0
          },
          sslInfo: {
            protocol: pageResult.url?.startsWith('https') ? 'https' : 'http',
            tlsVersion: pageResult.tlsVersion || 'N/A',
            certificateValid: pageResult.certificateValid || null
          },
          crawlSuccess: true,
          crawlSessionId
        };

        if (userId) siteDataPayload.userId = userId;

        const siteData = new SiteData(siteDataPayload);
        await siteData.save();
        savedPages.push(siteData._id);
      } else {
        failedPages.push({
          url: pageResult.url,
          depth: pageResult.depth,
          error: pageResult.error
        });
      }
    } catch (saveError) {
      logger.error(
        { url: pageResult.url, err: saveError.message },
        '[Worker] Failed to save page'
      );
      failedPages.push({
        url: pageResult.url,
        depth: pageResult.depth,
        error: { type: 'SAVE_ERROR', message: saveError.message }
      });
    }
  }

  const totalDuration = Date.now() - startTime;
  logger.info(
    { saved: savedPages.length, failed: failedPages.length, totalDuration },
    '[Worker] Recursive crawl persisted'
  );

  // Trigger n8n webhook (non-blocking)
  triggerRecursiveCrawl({ url, crawlResult, sessionId: crawlSessionId, savedPages });

  return {
    success: true,
    message: 'Recursive crawl completed successfully',
    crawlSessionId: crawlSessionId.toString(),
    summary: {
      ...crawlResult.summary,
      totalDuration,
      savedPages: savedPages.length,
      failedToSave: failedPages.length
    },
    startUrl: crawlResult.startUrl,
    baseUrl: crawlResult.baseUrl,
    maxDepthReached: crawlResult.maxDepthReached,
    savedPageIds: savedPages,
    failedPages: failedPages.length > 0 ? failedPages : undefined
  };
}

/**
 * Schema-driven extraction: fetch the page, then pull the requested fields
 * via CSS selectors and/or the LLM. Returns the structured result as the
 * job's return value (served by GET /api/crawl/jobs/:jobId).
 */
async function runExtract({ url, mode = 'auto', fields = [], selectors = null, socketId = null }) {
  logger.info({ url, mode }, '[Worker] Starting extraction');

  // keepRawHtml so the selector extractor has the full DOM to work with
  const crawlResult = await intelligentCrawl(url, {
    verbose: false,
    keepRawHtml: true,
    socketId,
    emitEvent: publishCrawlEvent
  });

  if (!crawlResult.success) {
    throw crawlError(
      crawlResult.error?.type || 'UNKNOWN',
      crawlResult.error?.message || 'Failed to fetch page for extraction'
    );
  }

  const rawHtml = crawlResult.rawHtml || '';
  const pageText = crawlResult.pageContent?.text || '';

  // Decide the effective extractor for 'auto'
  const hasSelectors = selectors && Object.keys(selectors).length > 0;
  const hasFields = Array.isArray(fields) && fields.length > 0;
  let effectiveMode = mode;
  if (mode === 'auto') {
    if (hasSelectors) effectiveMode = 'selectors';
    else if (hasFields && isLlmAvailable()) effectiveMode = 'llm';
    else effectiveMode = 'structured-only';
  }

  let data = {};
  if (effectiveMode === 'selectors') {
    if (!hasSelectors) throw crawlError('BAD_REQUEST', 'Selector mode requires selectors');
    data = extractWithSelectors(rawHtml, selectors);
  } else if (effectiveMode === 'llm') {
    if (!hasFields) throw crawlError('BAD_REQUEST', 'LLM mode requires fields');
    data = await extractWithLlm({ text: pageText, fields, url: crawlResult.url || url });
  }

  return {
    success: true,
    message: 'Extraction completed',
    url: crawlResult.url || url,
    mode: effectiveMode,
    method: crawlResult.method,
    data,
    // Always include the free structured data the page embedded
    structured: crawlResult.structured || null,
    content: crawlResult.pageContent
      ? {
          excerpt: crawlResult.pageContent.excerpt,
          author: crawlResult.pageContent.author,
          wordCount: crawlResult.pageContent.wordCount
        }
      : null
  };
}

async function processCrawlJob(job) {
  const payload = job.data;
  if (job.name === 'recursive') {
    return runRecursiveCrawl(payload);
  }
  if (job.name === 'extract') {
    return runExtract(payload);
  }
  return runSingleCrawl(payload);
}

module.exports = { processCrawlJob };
