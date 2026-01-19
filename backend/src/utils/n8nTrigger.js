const axios = require('axios');

/**
 * n8n Webhook Trigger Utility
 * Sends crawl completion data to n8n workflows
 * Features: Retry logic, error handling, non-blocking
 */

/**
 * Send crawl data to n8n webhook
 * @param {Object} crawlData - Data about the completed crawl
 * @param {string} crawlData.url - The crawled URL
 * @param {string} crawlData.crawlType - 'single' or 'recursive'
 * @param {string} crawlData.method - 'axios', 'puppeteer', or 'hybrid'
 * @param {boolean} crawlData.success - Whether crawl succeeded
 * @param {Object} crawlData.stats - Crawl statistics
 * @param {string} [crawlData.sessionId] - Session ID for recursive crawls
 * @returns {Promise<void>}
 */
async function triggerN8nWebhook(crawlData) {
  // Check if n8n integration is enabled
  const n8nEnabled = process.env.N8N_ENABLED === 'true';
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!n8nEnabled) {
    console.log('[n8n] Integration disabled (N8N_ENABLED=false)');
    return;
  }

  if (!webhookUrl) {
    console.warn('[n8n] Webhook URL not configured (N8N_WEBHOOK_URL missing)');
    return;
  }

  // Prepare payload
  const payload = {
    url: crawlData.url,
    crawlType: crawlData.crawlType,
    method: crawlData.method,
    success: crawlData.success,
    stats: {
      totalPages: crawlData.stats.totalPages || 1,
      linksFound: crawlData.stats.linksFound || 0,
      duration: crawlData.stats.duration || 0
    },
    timestamp: new Date().toISOString(),
    ...(crawlData.sessionId && { sessionId: crawlData.sessionId })
  };

  // Retry configuration
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  // Attempt to send with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[n8n] Sending webhook (attempt ${attempt}/${maxRetries})...`);
      
      const response = await axios.post(webhookUrl, payload, {
        timeout: 5000, // 5 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`[n8n] Webhook sent successfully (status: ${response.status})`);
      return; // Success - exit function

    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      
      if (error.code === 'ECONNREFUSED') {
        console.warn(`[n8n] Connection refused - is n8n running? (attempt ${attempt}/${maxRetries})`);
      } else if (error.code === 'ETIMEDOUT') {
        console.warn(`[n8n] Request timeout (attempt ${attempt}/${maxRetries})`);
      } else {
        console.warn(`[n8n] Webhook failed: ${error.message} (attempt ${attempt}/${maxRetries})`);
      }

      // If not the last attempt, wait before retrying (exponential backoff)
      if (!isLastAttempt) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.log(`[n8n] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[n8n] All retry attempts failed. Webhook not delivered.`);
      }
    }
  }
}

/**
 * Trigger n8n for a single page crawl
 * @param {Object} params
 * @param {string} params.url - Crawled URL
 * @param {Object} params.crawlResult - Result from hybridCrawler
 * @param {Object} params.siteData - Saved MongoDB document
 */
async function triggerSingleCrawl({ url, crawlResult, siteData }) {
  const crawlData = {
    url: url,
    crawlType: 'single',
    method: crawlResult.method || 'unknown',
    success: crawlResult.success || false,
    stats: {
      totalPages: 1,
      linksFound: (crawlResult.links || []).length,
      duration: crawlResult.duration || 0
    }
  };

  // Non-blocking - don't await, just catch errors
  triggerN8nWebhook(crawlData).catch(err => {
    console.error('[n8n] Failed to trigger webhook (non-blocking):', err.message);
  });
}

/**
 * Trigger n8n for a recursive crawl session
 * @param {Object} params
 * @param {string} params.url - Starting URL
 * @param {Object} params.crawlResult - Result from recursiveCrawl
 * @param {string} params.sessionId - Crawl session ID
 * @param {Array} params.savedPages - Array of saved page IDs
 */
async function triggerRecursiveCrawl({ url, crawlResult, sessionId, savedPages }) {
  // Calculate aggregated stats
  const totalPages = savedPages.length;
  const totalLinks = crawlResult.results.reduce((sum, page) => {
    return sum + (page.links || []).length;
  }, 0);
  
  const totalDuration = crawlResult.results.reduce((sum, page) => {
    return sum + (page.duration || 0);
  }, 0);

  // Determine primary method used by counting method occurrences
  const axiosCount = crawlResult.results.filter(page => page.method === 'axios').length;
  const puppeteerCount = crawlResult.results.filter(page => page.method === 'puppeteer').length;
  
  const method = puppeteerCount > axiosCount ? 'puppeteer' : 
                 axiosCount > 0 && puppeteerCount > 0 ? 'hybrid' : 'axios';

  const crawlData = {
    url: url,
    crawlType: 'recursive',
    method: method,
    success: crawlResult.success || false,
    stats: {
      totalPages: totalPages,
      linksFound: totalLinks,
      duration: totalDuration
    },
    sessionId: sessionId.toString()
  };

  // Non-blocking - don't await, just catch errors
  triggerN8nWebhook(crawlData).catch(err => {
    console.error('[n8n] Failed to trigger webhook (non-blocking):', err.message);
  });
}

module.exports = {
  triggerN8nWebhook,
  triggerSingleCrawl,
  triggerRecursiveCrawl
};
