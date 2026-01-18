/**
 * Hybrid Crawler Controller
 * Intelligently selects between Axios and Puppeteer crawlers
 * Tries Axios first (fast), falls back to Puppeteer if needed
 */

const { crawlWithAxios } = require('./crawlerAxios');
const { crawlWithPuppeteer } = require('./crawlerPuppeteer');
const { needsPuppeteer, getDetectionReport } = require('./crawlerDetector');
const { getErrorType } = require('./errorHandler');
const { normalizeUrl } = require('./urlValidator');
const mongoose = require('mongoose');

/**
 * Helper: Safely emit socket event
 * under the hood calls emitCrawlEvent function from socketService.js but it is used to provide safety like protection from null socketId, and helps to handle the errors from emitCrawlEvent function gracefully as it might fail due to some reason. and inside the Intelligent crawl function we cannot use try and catch each time so we wrap it inside this helper function.
 */
function safeEmit(emitEvent, eventName, data, socketId) {
    if (emitEvent && socketId) {
        try {
            emitEvent(eventName, data, socketId);
        } catch (error) {
            console.error(`[HYBRID] Failed to emit ${eventName}:`, error.message);
        }
    }
}

/**
 * Intelligently crawls a URL using the best method
 * @param {string} url - URL to crawl
 * @param {Object} options - Crawling options
 * @returns {Promise<Object>} Unified crawl result
 */
async function intelligentCrawl(url, options = {}) {
    const {
        forceMethod = null,           // 'axios' or 'puppeteer' to override detection
        detectionThreshold = 0.5,     // Confidence threshold for Puppeteer
        axiosOptions = {},            // Options for Axios crawler
        puppeteerOptions = {},        // Options for Puppeteer crawler
        verbose = true,               // Enable detailed logging
        socketId = null,              // Socket ID for real-time events
        emitEvent = null              // Event emitter function
    } = options;

    const startTime = Date.now();
    const crawlId = new mongoose.Types.ObjectId().toString();
    let method = 'axios';
    let axiosResult = null;
    let detection = null;

    // Emit crawl:start event
    safeEmit(emitEvent, 'crawl:start', {
        crawlId,
        startUrl: url,
        maxDepth: 0,
        timestamp: new Date().toISOString(),
        crawlType: 'single'
    }, socketId);

    try {
        // Force specific method if requested
        if (forceMethod === 'puppeteer') {
            if (verbose) console.log(`[HYBRID] Force using Puppeteer for: ${url}`);
            return await crawlWithPuppeteerWrapper(url, puppeteerOptions, startTime, 'forced');
        }

        if (forceMethod === 'axios') {
            if (verbose) console.log(`[HYBRID] Force using Axios for: ${url}`);
            return await crawlWithAxiosWrapper(url, axiosOptions, startTime, 'forced');
        }

        // Step 1: Try Axios first (fast path)
        if (verbose) console.log(`[HYBRID] Trying Axios first for: ${url}`);
        
        // Emit method-detected for Axios attempt
        safeEmit(emitEvent, 'crawl:method-detected', {
            url,
            method: 'axios',
            timestamp: new Date().toISOString(),
            reason: 'Initial attempt with fast method'
        }, socketId);
        
        try {
            axiosResult = await crawlWithAxios(url, axiosOptions);
            
            // Check if Axios crawl was successful
            if (!axiosResult || axiosResult.links.length === 0) {
                if (verbose) console.log(`[HYBRID] Axios returned no links, trying Puppeteer...`);
                
                // Emit method switch
                safeEmit(emitEvent, 'crawl:method-detected', {
                    url,
                    method: 'puppeteer',
                    timestamp: new Date().toISOString(),
                    reason: 'Axios returned no links, switching to Puppeteer'
                }, socketId);
                
                return await crawlWithPuppeteerWrapper(url, puppeteerOptions, startTime, 'axios_failed', emitEvent, socketId, crawlId);
            }

            // Step 2: Analyze the Axios result
            const html = axiosResult.content || '';
            detection = needsPuppeteer(html, axiosResult.links);

            if (verbose) {
                console.log(`[HYBRID] Detection: ${detection.needsPuppeteer ? 'Puppeteer needed' : 'Axios sufficient'}`);
                console.log(`[HYBRID] Confidence: ${detection.confidence}, Reason: ${detection.reason}`);
            }

            // Step 3: Decide based on detection confidence
            if (detection.needsPuppeteer && detection.confidence >= detectionThreshold) {
                if (verbose) console.log(`[HYBRID] Falling back to Puppeteer (confidence: ${detection.confidence})`);
                
                // Emit method switch
                safeEmit(emitEvent, 'crawl:method-detected', {
                    url,
                    method: 'puppeteer',
                    timestamp: new Date().toISOString(),
                    reason: `${detection.reason} (confidence: ${detection.confidence})`
                }, socketId);
                
                return await crawlWithPuppeteerWrapper(url, puppeteerOptions, startTime, detection.reason, emitEvent, socketId, crawlId);
            }

            // Step 4: Axios result is good enough
            if (verbose) console.log(`[HYBRID] Using Axios result (${axiosResult.links.length} links found)`);
            
            const duration = Date.now() - startTime;
            const result = {
                success: true,
                method: 'axios',
                duration,
                detectionReason: detection.reason,
                confidence: detection.confidence,
                framework: detection.framework,
                ...axiosResult
            };
            
            // Emit crawl:complete event
            safeEmit(emitEvent, 'crawl:complete', {
                crawlId,
                totalPages: 1,
                totalLinks: axiosResult.links.length,
                duration,
                method: 'axios',
                timestamp: new Date().toISOString()
            }, socketId);
            
            return result;

        } catch (axiosError) {
            // Axios failed, fallback to Puppeteer
            const errorType = getErrorType(axiosError);
            if (verbose) console.log(`[HYBRID] Axios failed (${errorType}), trying Puppeteer...`);
            
            // Emit method switch
            safeEmit(emitEvent, 'crawl:method-detected', {
                url,
                method: 'puppeteer',
                timestamp: new Date().toISOString(),
                reason: `Axios error: ${errorType}`
            }, socketId);
            
            return await crawlWithPuppeteerWrapper(url, puppeteerOptions, startTime, `axios_error: ${errorType}`, emitEvent, socketId, crawlId);
        }

    } catch (error) {
        const duration = Date.now() - startTime;
        const errorType = getErrorType(error);
        
        console.error(`[HYBRID] All methods failed for ${url}: ${error.message}`);
        
        // Emit crawl:error event
        safeEmit(emitEvent, 'crawl:error', {
            crawlId,
            errorMessage: error.message,
            errorType,
            timestamp: new Date().toISOString(),
            failedUrl: url,
            fatal: true
        }, socketId);
        
        return {
            success: false,
            method: 'none',
            duration,
            error: {
                type: errorType,
                message: error.message
            },
            url
        };
    }
}

/**
 * Wrapper for Axios crawler with timing and formatting
 */
async function crawlWithAxiosWrapper(url, options, startTime, reason, emitEvent = null, socketId = null, crawlId = null) {
    const result = await crawlWithAxios(url, options);
    const duration = Date.now() - startTime;
    
    const finalResult = {
        success: true,
        method: 'axios',
        duration,
        detectionReason: reason,
        ...result
    };
    
    // Emit crawl:complete if socket available
    safeEmit(emitEvent, 'crawl:complete', {
        crawlId,
        totalPages: 1,
        totalLinks: result.links?.length || 0,
        duration,
        method: 'axios',
        timestamp: new Date().toISOString()
    }, socketId);
    
    return finalResult;
}

/**
 * Wrapper for Puppeteer crawler with timing and formatting
 */
async function crawlWithPuppeteerWrapper(url, options, startTime, reason, emitEvent = null, socketId = null, crawlId = null) {
    const result = await crawlWithPuppeteer(url, options);
    const duration = Date.now() - startTime;
    
    const finalResult = {
        ...result,
        method: 'puppeteer',
        duration,
        detectionReason: reason
    };
    
    // Emit crawl:complete if socket available
    safeEmit(emitEvent, 'crawl:complete', {
        crawlId,
        totalPages: 1,
        totalLinks: result.links?.length || 0,
        duration,
        method: 'puppeteer',
        timestamp: new Date().toISOString()
    }, socketId);
    
    return finalResult;
}

/**
 * Batch crawl multiple URLs intelligently
 * @param {Array<string>} urls - URLs to crawl
 * @param {Object} options - Crawling options
 * @returns {Promise<Array>} Array of crawl results
 */
async function intelligentCrawlBatch(urls, options = {}) {
    const { concurrency = 3, ...crawlOptions } = options;
    const results = [];
    
    console.log(`[HYBRID] Batch crawling ${urls.length} URLs with concurrency ${concurrency}`);
    
    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(url => intelligentCrawl(url, crawlOptions))
        );
        results.push(...batchResults);
        
        // Small delay between batches
        if (i + concurrency < urls.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Generate summary
    const axiosCount = results.filter(r => r.method === 'axios').length;
    const puppeteerCount = results.filter(r => r.method === 'puppeteer').length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[HYBRID] Batch complete: ${axiosCount} Axios, ${puppeteerCount} Puppeteer, ${failedCount} failed`);
    
    return results;
}

/**
 * Helper: Extract base domain from URL
 */
function extractBaseDomain(url) {
    try {
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch {
        return null;
    }
}

/**
 * Helper: Check if URL belongs to same domain
 */
function isSameDomain(url, baseUrl) {
    const urlDomain = extractBaseDomain(url);
    const baseDomain = extractBaseDomain(baseUrl);
    return urlDomain === baseDomain;
}

/**
 * Helper: Delay for rate limiting
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Recursively crawls a website starting from a URL
 * @param {string} startUrl - Starting URL to crawl
 * @param {Object} options - Crawling options
 * @returns {Promise<Object>} Comprehensive crawl results
 */
async function recursiveCrawl(startUrl, options = {}) {
    const {
        maxDepth = 3,
        maxPages = 50,
        childLinksPerPage = 3,
        delayMs = 1500,
        sameDomainOnly = true,
        verbose = true,
        socketId = null,              // Socket ID for real-time events
        emitEvent = null,             // Event emitter function
        ...crawlOptions
    } = options;

    const visitedUrls = new Set();
    const results = [];
    const baseUrl = extractBaseDomain(startUrl);
    let maxDepthReached = 0;
    let linkEmitCounter = 0;  // Counter for throttling link-found events
    const crawlId = new mongoose.Types.ObjectId().toString();
    let currentDepthLevel = 0;

    if (verbose) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[RECURSIVE] Starting recursive crawl from: ${startUrl}`);
        console.log(`[RECURSIVE] Max depth: ${maxDepth}, Max pages: ${maxPages}`);
        console.log(`[RECURSIVE] Base domain: ${baseUrl}`);
        console.log('='.repeat(80));
    }
    
    // Emit crawl:start event
    safeEmit(emitEvent, 'crawl:start', {
        crawlId,
        startUrl,
        maxDepth,
        timestamp: new Date().toISOString(),
        crawlType: 'recursive'
    }, socketId);

    if (verbose) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[RECURSIVE] Starting recursive crawl from: ${startUrl}`);
        console.log(`[RECURSIVE] Max depth: ${maxDepth}, Max pages: ${maxPages}`);
        console.log(`[RECURSIVE] Base domain: ${baseUrl}`);
        console.log('='.repeat(80));
    }

    /**
     * Internal recursive function
     */
    async function crawlRecursive(url, currentDepth) {
        // Check limits
        if (currentDepth > maxDepth) {
            if (verbose) console.log(`[RECURSIVE] Depth limit reached at ${url}`);
            return;
        }

        if (visitedUrls.size >= maxPages) {
            if (verbose) console.log(`[RECURSIVE] Page limit reached (${maxPages} pages)`);
            return;
        }

        // Normalize and check if visited
        const normalizedUrl = normalizeUrl(url);
        if (!normalizedUrl) {
            if (verbose) console.log(`[RECURSIVE] Invalid URL: ${url}`);
            return;
        }

        if (visitedUrls.has(normalizedUrl)) {
            if (verbose) console.log(`[RECURSIVE] Already visited: ${normalizedUrl}`);
            return;
        }

        // Check same domain
        if (sameDomainOnly && !isSameDomain(url, baseUrl)) {
            if (verbose) console.log(`[RECURSIVE] Skipping external domain: ${url}`);
            return;
        }

        // Mark as visited
        visitedUrls.add(normalizedUrl);
        maxDepthReached = Math.max(maxDepthReached, currentDepth);
        
        // Emit depth-change event if depth level changed
        if (currentDepth !== currentDepthLevel) {
            currentDepthLevel = currentDepth;
            safeEmit(emitEvent, 'crawl:depth-change', {
                currentDepth,
                maxDepth,
                pagesAtThisDepth: results.filter(r => r.depth === currentDepth).length + 1,
                timestamp: new Date().toISOString()
            }, socketId);
        }

        if (verbose) {
            console.log(`\n[RECURSIVE] Depth ${currentDepth}: ${normalizedUrl} (${visitedUrls.size}/${maxPages})`);
        }
        
        // Emit progress event
        const percentage = Math.min(100, Math.round((visitedUrls.size / maxPages) * 100));
        safeEmit(emitEvent, 'crawl:progress', {
            percentage,
            pagesProcessed: visitedUrls.size,
            totalEstimate: maxPages,
            currentUrl: normalizedUrl,
            status: `Crawling depth ${currentDepth}: ${visitedUrls.size}/${maxPages} pages`
        }, socketId);

        try {
            // Crawl this URL using intelligent crawler
            const result = await intelligentCrawl(url, {
                ...crawlOptions,
                verbose: false  // Disable verbose for individual crawls
            });

            // Store result with depth info
            results.push({
                ...result,
                depth: currentDepth,
                crawledAt: new Date()
            });

            if (verbose) {
                console.log(`[RECURSIVE] ✅ Success - Method: ${result.method}, Links: ${result.links?.length || 0}`);
            }

            // Extract child links
            if (result.success && result.links && currentDepth < maxDepth) {
                const childLinks = result.links
                    .filter(link => {
                        const normalized = normalizeUrl(link);
                        return normalized && !visitedUrls.has(normalized);
                    })
                    .filter(link => !sameDomainOnly || isSameDomain(link, baseUrl))
                    .slice(0, childLinksPerPage);

                if (verbose && childLinks.length > 0) {
                    console.log(`[RECURSIVE] Following ${childLinks.length} child links...`);
                }
                
                // Emit link-found events (throttled - every 5 links)
                for (const childLink of childLinks) {
                    linkEmitCounter++;
                    if (linkEmitCounter % 5 === 0) {
                        safeEmit(emitEvent, 'crawl:link-found', {
                            url: childLink,
                            sourceUrl: normalizedUrl,
                            depth: currentDepth + 1,
                            linkCount: linkEmitCounter
                        }, socketId);
                    }
                }

                // Recursively crawl child links
                for (const childLink of childLinks) {
                    if (visitedUrls.size >= maxPages) break;

                    // Rate limiting
                    await delay(delayMs);

                    await crawlRecursive(childLink, currentDepth + 1);
                }
            }

        } catch (error) {
            const errorType = getErrorType(error);
            console.error(`[RECURSIVE] Error at depth ${currentDepth}: ${errorType} - ${error.message}`);
            
            // Emit non-fatal error event
            safeEmit(emitEvent, 'crawl:error', {
                crawlId,
                errorMessage: error.message,
                errorType,
                timestamp: new Date().toISOString(),
                failedUrl: normalizedUrl,
                fatal: false,
                depth: currentDepth
            }, socketId);
            
            results.push({
                success: false,
                url: normalizedUrl,
                depth: currentDepth,
                error: {
                    type: errorType,
                    message: error.message
                },
                crawledAt: new Date()
            });
        }
    }

    // Start recursive crawl
    const startTime = Date.now();
    await crawlRecursive(startUrl, 0);
    const totalDuration = Date.now() - startTime;

    // Generate summary
    const successfulResults = results.filter(r => r.success);
    const axiosCount = successfulResults.filter(r => r.method === 'axios').length;
    const puppeteerCount = successfulResults.filter(r => r.method === 'puppeteer').length;
    const failedCount = results.filter(r => !r.success).length;

    const summary = {
        totalPages: results.length,
        successfulPages: successfulResults.length,
        failedPages: failedCount,
        axiosCount,
        puppeteerCount,
        maxDepthReached,
        totalDuration,
        avgDuration: successfulResults.length > 0 
            ? Math.round(successfulResults.reduce((sum, r) => sum + (r.duration || 0), 0) / successfulResults.length)
            : 0
    };

    if (verbose) {
        console.log(`\n${'='.repeat(80)}`);
        console.log('[RECURSIVE] Crawl Complete');
        console.log('='.repeat(80));
        console.log(`Total pages: ${summary.totalPages}`);
        console.log(`Successful: ${summary.successfulPages}`);
        console.log(`Failed: ${summary.failedPages}`);
        console.log(`Axios: ${summary.axiosCount}`);
        console.log(`Puppeteer: ${summary.puppeteerCount}`);
        console.log(`Max depth reached: ${summary.maxDepthReached}`);
        console.log(`Total duration: ${summary.totalDuration}ms`);
        console.log(`Average duration: ${summary.avgDuration}ms`);
        console.log('='.repeat(80) + '\n');
    }
    
    // Calculate total links found
    const totalLinks = successfulResults.reduce((sum, r) => sum + (r.links?.length || 0), 0);
    
    // Emit crawl:complete event
    safeEmit(emitEvent, 'crawl:complete', {
        crawlId,
        totalPages: summary.totalPages,
        totalLinks,
        duration: summary.totalDuration,
        uniqueDomains: new Set(successfulResults.map(r => extractBaseDomain(r.url))).size,
        averageResponseTime: summary.avgDuration,
        maxDepthReached: summary.maxDepthReached,
        successRate: summary.totalPages > 0 ? ((summary.successfulPages / summary.totalPages) * 100).toFixed(2) + '%' : '0%',
        timestamp: new Date().toISOString()
    }, socketId);

    return {
        success: true,
        startUrl,
        baseUrl,
        totalPages: summary.totalPages,
        maxDepthReached: summary.maxDepthReached,
        results,
        summary
    };
}

module.exports = {
    intelligentCrawl,
    intelligentCrawlBatch,
    recursiveCrawl
};
