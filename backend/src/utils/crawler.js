const puppeteer = require('puppeteer');

/**
 * Crawls a website and extracts title and links.
 * @param {string} url - The URL to crawl.
 * @returns {Promise<{title: string, links: string[]}>} - The crawled data.
 */
async function crawlWebsite(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some environments
    });
    const page = await browser.newPage();
    
    // Set a reasonable timeout and user agent
    await page.setDefaultNavigationTimeout(30000); 
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2' });

    const title = await page.title();
    
    // Extract all hrefs
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href && href.startsWith('http')); // Filter valid http/https links
    });

    // Remove duplicates
    const uniqueLinks = [...new Set(links)];

    return {
      title,
      links: uniqueLinks
    };

  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { crawlWebsite };
