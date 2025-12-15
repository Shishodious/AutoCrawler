/**
 * Centralized Error Handling Utility
 * Provides error classification, severity levels, and retry logic
 */

// Error type constants
const ERROR_TYPES = {
    SSL_ERROR: 'SSL_ERROR',
    SSL_CERT_EXPIRED: 'SSL_CERT_EXPIRED',
    SSL_CERT_INVALID: 'SSL_CERT_INVALID',
    SSL_SELF_SIGNED: 'SSL_SELF_SIGNED',
    TIMEOUT: 'TIMEOUT',
    CONNECTION_REFUSED: 'CONNECTION_REFUSED',
    DNS_ERROR: 'DNS_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    HTTP_ERROR: 'HTTP_ERROR',
    INVALID_URL: 'INVALID_URL',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Error severity levels
const ERROR_SEVERITY = {
    LOW: 'LOW',           // Minor issues, can proceed with caution
    MEDIUM: 'MEDIUM',     // Moderate issues, may affect functionality
    HIGH: 'HIGH',         // Serious issues, likely to fail
    CRITICAL: 'CRITICAL'  // Critical issues, cannot proceed
};

/**
 * Classifies error types for better error handling
 * @param {Error} error - The error object
 * @returns {string} Error type classification
 */
function getErrorType(error) {
    // SSL/TLS Certificate Errors
    if (error.code === 'CERT_HAS_EXPIRED') {
        return ERROR_TYPES.SSL_CERT_EXPIRED;
    }
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
        error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        return ERROR_TYPES.SSL_CERT_INVALID;
    }
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || 
        error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        return ERROR_TYPES.SSL_SELF_SIGNED;
    }
    if (error.code === 'EPROTO' || 
        error.message.includes('SSL') || 
        error.message.includes('TLS')) {
        return ERROR_TYPES.SSL_ERROR;
    }

    // Network Errors
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        return ERROR_TYPES.TIMEOUT;
    }
    if (error.code === 'ECONNREFUSED') {
        return ERROR_TYPES.CONNECTION_REFUSED;
    }
    if (error.code === 'ENOTFOUND') {
        return ERROR_TYPES.DNS_ERROR;
    }

    // HTTP Errors
    if (error.response?.status === 429) {
        return ERROR_TYPES.RATE_LIMITED;
    }
    if (error.response) {
        return `${ERROR_TYPES.HTTP_ERROR}_${error.response.status}`;
    }

    // URL Errors
    if (error.code === 'ERR_INVALID_URL') {
        return ERROR_TYPES.INVALID_URL;
    }

    return ERROR_TYPES.UNKNOWN_ERROR;
}

/**
 * Gets detailed error information including severity and user-friendly messages
 * @param {Error} error - The error object
 * @returns {Object} Detailed error information
 */
function getDetailedErrorInfo(error) {
    const errorType = getErrorType(error);
    let severity = ERROR_SEVERITY.MEDIUM;
    let userMessage = 'An error occurred';
    let isRetryable = false;

    switch (errorType) {
        case ERROR_TYPES.SSL_CERT_EXPIRED:
            severity = ERROR_SEVERITY.HIGH;
            userMessage = 'SSL certificate has expired';
            isRetryable = false;
            break;

        case ERROR_TYPES.SSL_CERT_INVALID:
            severity = ERROR_SEVERITY.HIGH;
            userMessage = 'SSL certificate is invalid or unverified';
            isRetryable = false;
            break;

        case ERROR_TYPES.SSL_SELF_SIGNED:
            severity = ERROR_SEVERITY.MEDIUM;
            userMessage = 'Site uses a self-signed SSL certificate';
            isRetryable = true; // Can retry with legacy mode
            break;

        case ERROR_TYPES.SSL_ERROR:
            severity = ERROR_SEVERITY.HIGH;
            userMessage = 'SSL/TLS handshake failed';
            isRetryable = true; // Can retry with legacy mode
            break;

        case ERROR_TYPES.TIMEOUT:
            severity = ERROR_SEVERITY.MEDIUM;
            userMessage = 'Connection timed out - site may be slow or unresponsive';
            isRetryable = true;
            break;

        case ERROR_TYPES.CONNECTION_REFUSED:
            severity = ERROR_SEVERITY.HIGH;
            userMessage = 'Connection refused - site may be offline';
            isRetryable = false;
            break;

        case ERROR_TYPES.DNS_ERROR:
            severity = ERROR_SEVERITY.CRITICAL;
            userMessage = 'Domain not found - check the URL';
            isRetryable = false;
            break;

        case ERROR_TYPES.RATE_LIMITED:
            severity = ERROR_SEVERITY.MEDIUM;
            userMessage = 'Rate limited - too many requests';
            isRetryable = true;
            break;

        case ERROR_TYPES.INVALID_URL:
            severity = ERROR_SEVERITY.CRITICAL;
            userMessage = 'Invalid URL format';
            isRetryable = false;
            break;

        default:
            if (errorType.startsWith('HTTP_ERROR_')) {
                const statusCode = parseInt(errorType.split('_')[2]);
                if (statusCode >= 400 && statusCode < 500) {
                    severity = ERROR_SEVERITY.MEDIUM;
                    userMessage = `HTTP ${statusCode} - Client error`;
                    isRetryable = false;
                } else if (statusCode >= 500) {
                    severity = ERROR_SEVERITY.HIGH;
                    userMessage = `HTTP ${statusCode} - Server error`;
                    isRetryable = true;
                }
            } else {
                severity = ERROR_SEVERITY.MEDIUM;
                userMessage = error.message || 'Unknown error occurred';
                isRetryable = false;
            }
    }

    return {
        type: errorType,
        message: error.message,
        severity,
        isRetryable,
        userMessage,
        code: error.code,
        statusCode: error.response?.status
    };
}

/**
 * Determines if an error should not be retried
 * @param {Error} error - The error object
 * @returns {boolean} True if error should not be retried
 */
function shouldNotRetry(error) {
    const noRetryErrors = [
        'ENOTFOUND',           // DNS error
        'ERR_INVALID_URL',     // Invalid URL
        'CERT_HAS_EXPIRED',    // Expired certificate
        'ECONNREFUSED'         // Connection refused
    ];
    
    const noRetryStatuses = [400, 401, 403, 404, 410]; // Client errors
    
    if (noRetryErrors.includes(error.code)) return true;
    if (error.response && noRetryStatuses.includes(error.response.status)) return true;
    
    return false;
}

module.exports = {
    ERROR_TYPES,
    ERROR_SEVERITY,
    getErrorType,
    getDetailedErrorInfo,
    shouldNotRetry
};
