const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const { URL } = require('url');
const { normalizeUrl } = require('./urlValidator');
const { getErrorType, shouldNotRetry } = require('./errorHandler');

// Constants
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Creates a secure Axios instance with strict TLS 1.2+ security
 * @returns {import('axios').AxiosInstance} Configured Axios instance
 */
function createSecureAxiosInstance() {
    return axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: true,          // Strict certificate checking
            minVersion: 'TLSv1.2',             // Secure minimum protocol
            maxVersion: 'TLSv1.3'
        }),
        timeout: 30000,
        maxRedirects: 5,
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
        },
        validateStatus: status => status < 500
    });
}

/**
 * Creates a legacy fallback Axios instance for older/self-signed certificates
 * @returns {import('axios').AxiosInstance} Configured Axios instance
 */
function createLegacyAxiosInstance() {
    return axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,             // Allow old/self-signed certs ONLY when necessary
            secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
            minVersion: 'TLSv1',                   // Enables TLS 1.0 compatibility
            maxVersion: 'TLSv1.3'
        }),
        timeout: 30000,
        maxRedirects: 5,
        headers: { 'User-Agent': USER_AGENT },
        validateStatus: status => status < 500
    });
}

// getErrorType and shouldNotRetry are now imported from errorHandler.js

/**
 * Fetches a URL with retry logic and automatic fallback to legacy TLS
 * @param {string} url - The URL to fetch
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<import('axios').AxiosResponse>} Axios response object
 */
async function fetchWithRetry(url, maxRetries = 2) {
    const secureAxios = createSecureAxiosInstance();
    const legacyAxios = createLegacyAxiosInstance();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[FETCH] Secure attempt ${attempt}: ${url}`);
            return await secureAxios.get(url);

        } catch (error) {
            const errType = getErrorType(error);
            console.log(`[FETCH] Secure failed (${errType})`);

            if (errType === 'SSL_ERROR') {
                console.log(`[FETCH] Trying legacy TLS compatibility mode...`);
                try {
                    return await legacyAxios.get(url);
                } catch (legacyErr) {
                    console.log(`[FETCH] Legacy also failed.`);
                    throw legacyErr; // Throw the legacy error for proper handling
                }
            }

            if (attempt < maxRetries && !shouldNotRetry(error)) {
                const waitTime = 1500 * attempt;
                console.log(`[FETCH] Retrying in ${waitTime}ms...`);
                await new Promise(res => setTimeout(res, waitTime));
                continue;
            }

            throw error;
        }
    }
}

// normalizeUrl is now imported from urlValidator.js

/**
 * Crawls a website using Axios and Cheerio
 * @param {string} url - The URL to crawl
 * @param {Object} options - Crawling options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 2)
 * @returns {Promise<{title: string, links: string[], url: string, timestamp: Date}>} Crawled data
 */
async function crawlWithAxios(url, options = {}) {
    const { maxRetries = 2 } = options;
    
    try {
        console.log(`[CRAWLER] Starting crawl: ${url}`);
        
        // Fetch the HTML content
        const response = await fetchWithRetry(url, maxRetries);
        
        // Check if response is successful
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
        }

        // Parse HTML with Cheerio
        const $ = cheerio.load(response.data);
        
        // Extract title
        const title = $('title').text().trim() || 'No title found';
        
        // Extract all links
        const links = [];
        $('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                try {
                    // Convert relative URLs to absolute URLs
                    const absoluteUrl = new URL(href, url).href;
                    // Only include http/https links
                    if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
                        links.push(absoluteUrl);
                    }
                } catch (err) {
                    // Skip invalid URLs
                    console.log(`[CRAWLER] Skipping invalid URL: ${href}`);
                }
            }
        });

        // Remove duplicates
        const uniqueLinks = [...new Set(links)];

        console.log(`[CRAWLER] Successfully crawled ${url} - Found ${uniqueLinks.length} unique links`);

        return {
            title,
            links: uniqueLinks,
            url: normalizeUrl(url) || url,
            timestamp: new Date(),
            content: response.data  // Add HTML content for detection
        };

    } catch (error) {
        const errType = getErrorType(error);
        console.error(`[CRAWLER] Error crawling ${url}: ${errType} - ${error.message}`);
        throw new Error(`Failed to crawl ${url}: ${errType} - ${error.message}`);
    }
}

module.exports = {
    createSecureAxiosInstance,
    createLegacyAxiosInstance,
    fetchWithRetry,
    crawlWithAxios
};
