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
const { publishCrawlEvent } = require('./progressPublisher');
const logger = require('../config/logger');

/** Throw an error that carries the crawl error type for the job's failedReason */
function crawlError(type, message) {
  const err = new Error(`${type}: ${message}`);
  err.errorType = type;
  return err;
}

async function runSingleCrawl({ url, options = {}, userId = null, socketId = null }) {
  logger.info({ url, socketId }, '[Worker] Starting single crawl');

  const crawlResult = await intelligentCrawl(url, {
    ...options,
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
    crawlSuccess: true
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

  return {
    success: true,
    message: 'Crawl completed successfully',
    data: {
      id: siteData._id,
      url: siteData.url,
      title: siteData.title,
      links: siteData.links,
      metadata: siteData.metadata,
      crawlerStats: siteData.crawlerStats,
      sslInfo: siteData.sslInfo,
      detectionInfo: {
        reason: crawlResult.detectionReason || 'N/A',
        confidence: crawlResult.confidence || 0,
        framework: crawlResult.framework || null
      },
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

async function processCrawlJob(job) {
  const payload = job.data;
  if (job.name === 'recursive') {
    return runRecursiveCrawl(payload);
  }
  return runSingleCrawl(payload);
}

module.exports = { processCrawlJob };
