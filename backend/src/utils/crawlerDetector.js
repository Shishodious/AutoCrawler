/**
 * Crawler Detector - Intelligent detection of whether a site needs Puppeteer
 * Analyzes HTML content to determine if JavaScript rendering is required
 */

const cheerio = require('cheerio');

// Framework detection patterns
const FRAMEWORK_PATTERNS = {
    react: [
        /<div[^>]*id=["']root["']/i,
        /__REACT_/,
        /react/i,
        /_next\/static/,
        /__NEXT_DATA__/
    ],
    vue: [
        /<div[^>]*id=["']app["']/i,
        /Vue\./,
        /vue\.js/i,
        /__NUXT__/
    ],
    angular: [
        /ng-app/i,
        /ng-version/i,
        /angular/i,
        /@angular/i
    ],
    nextjs: [
        /__NEXT_DATA__/,
        /_next\/static/,
        /next\.js/i
    ],
    nuxt: [
        /__NUXT__/,
        /nuxt\.js/i
    ]
};

/**
 * Detects JavaScript frameworks in HTML content
 * @param {string} html - HTML content to analyze
 * @returns {string|null} Detected framework name or null
 */
function detectFramework(html) {
    if (!html) return null;

    for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(html)) {
                return framework;
            }
        }
    }

    // Check meta tags
    const $ = cheerio.load(html);
    const generator = $('meta[name="generator"]').attr('content');
    if (generator) {
        const genLower = generator.toLowerCase();
        if (genLower.includes('react')) return 'react';
        if (genLower.includes('vue')) return 'vue';
        if (genLower.includes('angular')) return 'angular';
        if (genLower.includes('next')) return 'nextjs';
        if (genLower.includes('nuxt')) return 'nuxt';
    }

    return null;
}

/**
 * Analyzes content metrics from HTML
 * @param {string} html - HTML content to analyze
 * @returns {Object} Content analysis metrics
 */
function analyzeContent(html) {
    if (!html) {
        return {
            scriptCount: 0,
            bodyLength: 0,
            textLength: 0,
            scriptToContentRatio: 1,
            hasMinimalContent: true
        };
    }

    const $ = cheerio.load(html);
    
    // Count scripts
    const scriptCount = $('script').length;
    
    // Get body content
    const bodyHtml = $('body').html() || '';
    const bodyLength = bodyHtml.length;
    
    // Get text content (without scripts and styles)
    $('script, style, noscript').remove();
    const textContent = $('body').text().trim();
    const textLength = textContent.length;
    
    // Calculate script-to-content ratio
    const scriptToContentRatio = textLength > 0 ? scriptCount / (textLength / 1000) : scriptCount;
    
    // Check if content is minimal
    const hasMinimalContent = textLength < 500;

    return {
        scriptCount,
        bodyLength,
        textLength,
        scriptToContentRatio,
        hasMinimalContent
    };
}

/**
 * Determines if a website needs Puppeteer based on HTML analysis
 * @param {string} html - HTML content from Axios crawl
 * @param {Array} links - Links found by Axios crawler
 * @returns {Object} Detection result with confidence score
 */
function needsPuppeteer(html, links = []) {
    const reasons = [];
    let confidence = 0;

    // 1. Check for framework indicators (high confidence)
    const framework = detectFramework(html);
    if (framework) {
        reasons.push(`${framework.toUpperCase()} framework detected`);
        confidence += 0.4;
    }

    // 2. Check link count (medium confidence)
    const linkCount = links.length;
    if (linkCount < 5) {
        reasons.push(`Low link count (${linkCount} links)`);
        confidence += 0.3;
    }

    // 3. Analyze content metrics
    const metrics = analyzeContent(html);
    
    // High script-to-content ratio (medium confidence)
    if (metrics.scriptToContentRatio > 5) {
        reasons.push(`High script-to-content ratio (${metrics.scriptToContentRatio.toFixed(1)})`);
        confidence += 0.2;
    }

    // Minimal content (low confidence)
    if (metrics.hasMinimalContent) {
        reasons.push(`Minimal text content (${metrics.textLength} chars)`);
        confidence += 0.1;
    }

    // Many scripts with little content (medium confidence)
    if (metrics.scriptCount > 10 && metrics.textLength < 1000) {
        reasons.push(`Many scripts (${metrics.scriptCount}) with little content`);
        confidence += 0.2;
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    // Decision: needs Puppeteer if confidence > 0.5
    const needsPuppeteerDecision = confidence > 0.5;

    return {
        needsPuppeteer: needsPuppeteerDecision,
        confidence: parseFloat(confidence.toFixed(2)),
        reason: reasons.length > 0 ? reasons.join(', ') : 'Static content detected',
        framework: framework || 'none',
        metrics: {
            linkCount,
            scriptCount: metrics.scriptCount,
            textLength: metrics.textLength,
            scriptToContentRatio: parseFloat(metrics.scriptToContentRatio.toFixed(2))
        }
    };
}

/**
 * Generates a detailed detection report for debugging
 * @param {string} html - HTML content
 * @param {Array} links - Links found
 * @returns {Object} Detailed detection report
 */
function getDetectionReport(html, links = []) {
    const framework = detectFramework(html);
    const metrics = analyzeContent(html);
    const detection = needsPuppeteer(html, links);

    return {
        detection,
        framework,
        contentMetrics: {
            linkCount: links.length,
            scriptCount: metrics.scriptCount,
            bodyLength: metrics.bodyLength,
            textLength: metrics.textLength,
            scriptToContentRatio: parseFloat(metrics.scriptToContentRatio.toFixed(2)),
            hasMinimalContent: metrics.hasMinimalContent
        },
        recommendation: detection.needsPuppeteer 
            ? 'Use Puppeteer for JavaScript rendering' 
            : 'Axios is sufficient for this site'
    };
}

module.exports = {
    detectFramework,
    analyzeContent,
    needsPuppeteer,
    getDetectionReport
};
