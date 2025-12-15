/**
 * URL Validation and Sanitization Utility
 * Provides URL normalization, validation, and sanitization functions
 */

const { URL } = require('url');
const dns = require('dns').promises;
const axios = require('axios');
const https = require('https');
const { getErrorType, getDetailedErrorInfo } = require('./errorHandler');

/**
 * Normalizes a URL by removing trailing slashes and returning origin + pathname
 * @param {string} url - The URL to normalize
 * @returns {string|null} Normalized URL or null if invalid
 */
function normalizeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin + parsedUrl.pathname.replace(/\/$/, '');
    } catch {
        return null;
    }
}

/**
 * Validates URL format and checks for malicious schemes
 * @param {string} url - The URL to validate
 * @returns {boolean} True if URL format is valid and safe
 */
function isValidUrlFormat(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Only allow HTTP and HTTPS protocols
        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            return false;
        }

        // Filter out malicious schemes (even if somehow passed as part of URL)
        const maliciousSchemes = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
        const urlLower = url.toLowerCase();
        if (maliciousSchemes.some(scheme => urlLower.includes(scheme))) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Converts a relative URL to an absolute URL
 * @param {string} relativeUrl - The relative URL
 * @param {string} baseUrl - The base URL to resolve against
 * @returns {string|null} Absolute URL or null if invalid
 */
function convertToAbsoluteUrl(relativeUrl, baseUrl) {
    try {
        const absoluteUrl = new URL(relativeUrl, baseUrl);
        
        // Validate the resulting URL
        if (!isValidUrlFormat(absoluteUrl.href)) {
            return null;
        }
        
        return absoluteUrl.href;
    } catch {
        return null;
    }
}

/**
 * Sanitizes an array of links by converting to absolute, filtering invalid/malicious, and removing duplicates
 * @param {string[]} links - Array of links to sanitize
 * @param {string} baseUrl - Base URL for converting relative links
 * @returns {string[]} Array of sanitized, normalized, unique links
 */
function sanitizeLinks(links, baseUrl) {
    const processedLinks = new Set();

    for (const link of links) {
        if (!link || typeof link !== 'string') continue;

        // Convert to absolute URL if relative
        let absoluteUrl = link;
        if (!link.startsWith('http://') && !link.startsWith('https://')) {
            absoluteUrl = convertToAbsoluteUrl(link, baseUrl);
            if (!absoluteUrl) continue; // Skip invalid conversions
        }

        // Validate URL format and filter malicious links
        if (!isValidUrlFormat(absoluteUrl)) {
            console.log(`[URL_VALIDATOR] Filtered malicious/invalid URL: ${link}`);
            continue;
        }

        // Normalize and add to set (automatically handles duplicates)
        const normalized = normalizeUrl(absoluteUrl);
        if (normalized) {
            processedLinks.add(normalized);
        }
    }

    return Array.from(processedLinks);
}

/**
 * Validates a URL with comprehensive checks including DNS lookup and connectivity test
 * @param {string} url - The URL to validate
 * @param {Object} options - Validation options
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {boolean} options.checkConnectivity - Whether to test connectivity (default: true)
 * @returns {Promise<Object>} Validation result with detailed information
 */
async function validateUrl(url, options = {}) {
    const { timeout = 10000, checkConnectivity = true } = options;
    
    const issues = [];
    const warnings = [];
    let isSafe = true;
    let finalUrl = url;
    let statusCode = null;
    let redirectChain = [];

    try {
        // Step 1: Normalize missing protocol
        if (!/^https?:\/\//i.test(url)) {
            finalUrl = `https://${url}`;
            warnings.push('Protocol missing — assumed HTTPS');
        }

        const parsedUrl = new URL(finalUrl);

        // Step 2: Validate protocol
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            issues.push('Invalid protocol (only HTTP and HTTPS are supported)');
            return { 
                url: finalUrl, 
                statusCode, 
                redirectChain, 
                isSafe: false, 
                issues, 
                warnings, 
                canProceed: false 
            };
        }

        // Check for malicious schemes
        if (!isValidUrlFormat(finalUrl)) {
            issues.push('Malicious or invalid URL format detected');
            return { 
                url: finalUrl, 
                statusCode, 
                redirectChain, 
                isSafe: false, 
                issues, 
                warnings, 
                canProceed: false 
            };
        }

        if (parsedUrl.protocol === 'http:') {
            warnings.push('Site uses HTTP — not encrypted');
        }

        // Step 3: DNS lookup
        try {
            await dns.lookup(parsedUrl.hostname);
        } catch (dnsError) {
            issues.push('Domain not found (DNS lookup failed)');
            return { 
                url: finalUrl, 
                statusCode, 
                redirectChain, 
                isSafe: false, 
                issues, 
                warnings, 
                canProceed: false 
            };
        }

        // Step 4: Test connectivity (if enabled)
        if (checkConnectivity) {
            // Use a lightweight HTTPS agent for validation only
            const validationAgent = new https.Agent({ 
                rejectUnauthorized: true,
                timeout: timeout
            });

            try {
                const response = await axios.head(finalUrl, {
                    timeout,
                    httpsAgent: validationAgent,
                    maxRedirects: 5,
                    validateStatus: (status) => status < 500,
                });

                statusCode = response.status;
                
                // Track redirect chain
                if (response.request?.res?.responseUrl && response.request.res.responseUrl !== finalUrl) {
                    redirectChain = [url, response.request.res.responseUrl];
                }

                if (statusCode >= 400 && statusCode < 500) {
                    warnings.push(`Site returned ${statusCode} — might block crawlers`);
                } else if (statusCode >= 500) {
                    issues.push(`Server error ${statusCode}`);
                    isSafe = false;
                }
            } catch (error) {
                const errorInfo = getDetailedErrorInfo(error);
                
                // Classify as issue or warning based on severity
                if (errorInfo.severity === 'CRITICAL' || errorInfo.severity === 'HIGH') {
                    issues.push(errorInfo.userMessage);
                    isSafe = false;
                } else {
                    warnings.push(errorInfo.userMessage);
                }

                // Set status code if available
                if (errorInfo.statusCode) {
                    statusCode = errorInfo.statusCode;
                }
            }
        }

    } catch (error) {
        issues.push('Invalid URL format');
        isSafe = false;
    }

    return {
        url: normalizeUrl(finalUrl) || finalUrl,
        statusCode,
        redirectChain,
        isSafe,
        issues,
        warnings,
        canProceed: isSafe && issues.length === 0,
    };
}

module.exports = {
    normalizeUrl,
    isValidUrlFormat,
    convertToAbsoluteUrl,
    sanitizeLinks,
    validateUrl
};
