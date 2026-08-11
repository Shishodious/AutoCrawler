/**
 * Enhanced Puppeteer Crawler
 * Features: Resource blocking, auto-scroll, lazy loading, screenshots, metadata extraction
 */

const puppeteer = require('puppeteer');
const { normalizeUrl, sanitizeLinks } = require('./urlValidator');
const { getErrorType, getDetailedErrorInfo } = require('./errorHandler');

// Constants
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Resource types to block for better performance
const BLOCKED_RESOURCE_TYPES = ['image', 'stylesheet', 'font', 'media', 'websocket'];
const BLOCKED_DOMAINS = ['google-analytics.com', 'googletagmanager.com', 'facebook.com/tr'];

/**
 * Creates and launches a browser instance with optimized settings
 * @param {Object} options - Browser launch options
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function createBrowserInstance(options = {}) {
    const { headless = true } = options;
    
    return await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });
}

// Shared browser instance — launched once per process and reused across
// crawls (pages are opened/closed per crawl instead). Prevents the cost and
// memory blow-up of launching Chromium for every job in the worker.
let sharedBrowserPromise = null;

/**
 * Returns the shared browser, launching it on first use and relaunching
 * if the previous instance crashed or disconnected.
 * @param {Object} options - Browser launch options
 * @returns {Promise<Browser>} Shared Puppeteer browser instance
 */
async function getSharedBrowser(options = {}) {
    if (sharedBrowserPromise) {
        const browser = await sharedBrowserPromise.catch(() => null);
        const alive = browser &&
            (typeof browser.connected === 'boolean' ? browser.connected : browser.isConnected());
        if (alive) return browser;
        sharedBrowserPromise = null;
    }
    sharedBrowserPromise = createBrowserInstance(options);
    return sharedBrowserPromise;
}

/**
 * Closes the shared browser (call on process shutdown).
 */
async function closeSharedBrowser() {
    if (!sharedBrowserPromise) return;
    const browser = await sharedBrowserPromise.catch(() => null);
    sharedBrowserPromise = null;
    if (browser) {
        await browser.close().catch(() => {});
        console.log('[PUPPETEER] Shared browser closed');
    }
}

/**
 * Sets up request interception to block unnecessary resources
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Blocking options
 */
async function setupResourceBlocking(page, options = {}) {
    const { blockResources = true, customBlockedTypes = [], customBlockedDomains = [] } = options;
    
    if (!blockResources) return;

    const blockedTypes = [...BLOCKED_RESOURCE_TYPES, ...customBlockedTypes];
    const blockedDomains = [...BLOCKED_DOMAINS, ...customBlockedDomains];

    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
        const resourceType = request.resourceType();
        const url = request.url();
        
        // Block if resource type is in blocked list
        if (blockedTypes.includes(resourceType)) {
            request.abort();
            return;
        }
        
        // Block if domain is in blocked list
        if (blockedDomains.some(domain => url.includes(domain))) {
            request.abort();
            return;
        }
        
        request.continue();
    });
}

/**
 * Auto-scrolls the page to trigger lazy-loaded content
 * @param {Page} page - Puppeteer page instance
 * @param {Object} options - Scroll options
 */
async function autoScroll(page, options = {}) {
    const { maxScrolls = 10, scrollDelay = 100 } = options;
    
    await page.evaluate(async (maxScrolls, scrollDelay) => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let scrollCount = 0;
            const distance = 100;
            
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                scrollCount++;

                if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
                    clearInterval(timer);
                    resolve();
                }
            }, scrollDelay);
        });
    }, maxScrolls, scrollDelay);
    
    // Wait for any lazy-loaded content to render
    await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Extracts comprehensive page data including metadata
 * @param {Page} page - Puppeteer page instance
 * @param {string} url - Original URL
 * @returns {Promise<Object>} Extracted page data
 */
async function extractPageData(page, url) {
    const data = await page.evaluate(() => {
        // Extract title
        const title = document.title || '';
        
        // Extract meta tags
        const getMetaContent = (name) => {
            const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            return meta ? meta.getAttribute('content') : null;
        };
        
        const description = getMetaContent('description') || getMetaContent('og:description');
        const keywords = getMetaContent('keywords');
        const ogTitle = getMetaContent('og:title');
        const ogImage = getMetaContent('og:image');
        const twitterCard = getMetaContent('twitter:card');
        
        // Extract all links
        const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(href => href && (href.startsWith('http://') || href.startsWith('https://')));
        
        // Extract headings for content structure
        const headings = {
            h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
            h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim())
        };
        
        return {
            title,
            description,
            keywords,
            links,
            metadata: {
                ogTitle,
                ogImage,
                twitterCard
            },
            headings
        };
    });
    
    // Sanitize and normalize links
    const sanitizedLinks = sanitizeLinks(data.links, url);
    
    return {
        ...data,
        links: sanitizedLinks,
        url: normalizeUrl(url) || url
    };
}

/**
 * Main Puppeteer crawler function
 * @param {string} url - URL to crawl
 * @param {Object} options - Crawling options
 * @returns {Promise<Object>} Crawled data
 */
async function crawlWithPuppeteer(url, options = {}) {
    const {
        blockResources = true,
        autoScrollEnabled = false,
        screenshot = false,
        waitUntil = 'networkidle2',
        timeout = 30000,
        viewport = { width: 1920, height: 1080 }
    } = options;
    
    let page;

    try {
        console.log(`[PUPPETEER] Starting crawl: ${url}`);

        // Reuse the shared browser; only the page is per-crawl
        const browser = await getSharedBrowser({ headless: options.headless });
        page = await browser.newPage();
        
        // Set user agent and viewport
        await page.setUserAgent(USER_AGENT);
        await page.setViewport(viewport);
        
        // Set default timeout
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);
        
        // Setup resource blocking if enabled
        await setupResourceBlocking(page, { 
            blockResources, 
            customBlockedTypes: options.customBlockedTypes,
            customBlockedDomains: options.customBlockedDomains
        });
        
        // Navigate to URL
        await page.goto(url, { 
            waitUntil,
            timeout 
        });
        
        // Auto-scroll if enabled
        if (autoScrollEnabled) {
            console.log(`[PUPPETEER] Auto-scrolling to load lazy content...`);
            await autoScroll(page, {
                maxScrolls: options.maxScrolls,
                scrollDelay: options.scrollDelay
            });
        }
        
        // Extract page data
        const pageData = await extractPageData(page, url);
        
        // Take screenshot if requested
        let screenshotPath = null;
        if (screenshot) {
            const timestamp = Date.now();
            screenshotPath = `./screenshots/screenshot-${timestamp}.png`;
            await page.screenshot({ 
                path: screenshotPath, 
                fullPage: true 
            });
            console.log(`[PUPPETEER] Screenshot saved: ${screenshotPath}`);
        }
        
        console.log(`[PUPPETEER] Successfully crawled ${url} - Found ${pageData.links.length} unique links`);
        
        return {
            success: true,
            ...pageData,
            screenshot: screenshotPath,
            timestamp: new Date(),
            options: {
                blockResources,
                autoScrollEnabled,
                screenshot
            }
        };
        
    } catch (error) {
        const errorInfo = getDetailedErrorInfo(error);
        console.error(`[PUPPETEER] Error crawling ${url}: ${errorInfo.type} - ${error.message}`);
        
        return {
            success: false,
            url: normalizeUrl(url) || url,
            error: {
                type: errorInfo.type,
                message: errorInfo.userMessage,
                severity: errorInfo.severity,
                isRetryable: errorInfo.isRetryable
            },
            timestamp: new Date()
        };
        
    } finally {
        if (page) {
            await page.close().catch(() => {});
            console.log(`[PUPPETEER] Page closed`);
        }
    }
}

module.exports = {
    crawlWithPuppeteer,
    createBrowserInstance,
    getSharedBrowser,
    closeSharedBrowser,
    setupResourceBlocking,
    autoScroll,
    extractPageData
};
