/**
 * Block / challenge detection.
 * The crawler's detector only distinguishes "static vs JS-heavy". This adds a
 * separate axis: is the response actually usable, or did we hit a captcha, an
 * anti-bot interstitial, a login wall, or a rate-limit / block page? Knowing
 * *why* a hard target failed lets the pipeline report it honestly instead of
 * persisting a garbage "success".
 */

const BLOCK_STATES = {
  OK: 'OK',
  BLOCKED: 'BLOCKED',
  CAPTCHA: 'CAPTCHA',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED'
};

// Signatures in page HTML/title that indicate a challenge rather than content.
const CAPTCHA_PATTERNS = [
  /captcha/i,
  /recaptcha/i,
  /hcaptcha/i,
  /cf-challenge/i,
  /turnstile/i,
  /are you (a )?human/i,
  /verify you are human/i,
  /i'?m not a robot/i
];

const ANTIBOT_PATTERNS = [
  /just a moment/i, // Cloudflare interstitial
  /checking your browser/i,
  /enable javascript and cookies to continue/i,
  /ddos protection by/i,
  /access denied/i,
  /request blocked/i,
  /you have been blocked/i,
  /unusual traffic/i,
  /automated (access|requests)/i,
  /bot detection/i,
  /perimeterx|datadome|incapsula|imperva/i
];

const AUTH_PATTERNS = [
  /sign in to continue/i,
  /log ?in to (continue|view|see)/i,
  /please log ?in/i,
  /you must be logged in/i,
  /members only/i,
  /subscribe to (read|continue)/i
];

function anyMatch(patterns, text) {
  return patterns.some((re) => re.test(text));
}

/**
 * Classify a fetched page.
 * @param {Object} params
 * @param {number} [params.statusCode]
 * @param {string} [params.html]
 * @param {string} [params.title]
 * @param {number} [params.textLength] - length of extracted readable text
 * @returns {{ state: string, blocked: boolean, reason: string|null }}
 */
function detectBlock({ statusCode, html = '', title = '', textLength = null }) {
  // Status-code signals first — cheapest and most authoritative
  if (statusCode === 401) {
    return { state: BLOCK_STATES.AUTH_REQUIRED, blocked: true, reason: 'HTTP 401 Unauthorized' };
  }
  if (statusCode === 429) {
    return { state: BLOCK_STATES.RATE_LIMITED, blocked: true, reason: 'HTTP 429 Too Many Requests' };
  }
  if (statusCode === 403) {
    return { state: BLOCK_STATES.BLOCKED, blocked: true, reason: 'HTTP 403 Forbidden' };
  }

  const haystack = `${title}\n${html}`;

  if (anyMatch(CAPTCHA_PATTERNS, haystack)) {
    return { state: BLOCK_STATES.CAPTCHA, blocked: true, reason: 'Captcha challenge detected in page' };
  }
  if (anyMatch(ANTIBOT_PATTERNS, haystack)) {
    return { state: BLOCK_STATES.BLOCKED, blocked: true, reason: 'Anti-bot / interstitial page detected' };
  }
  // Login walls only count when the page is otherwise thin — many normal pages
  // have a "log in" link without being gated.
  if ((textLength === null || textLength < 400) && anyMatch(AUTH_PATTERNS, haystack)) {
    return { state: BLOCK_STATES.AUTH_REQUIRED, blocked: true, reason: 'Login wall detected' };
  }

  return { state: BLOCK_STATES.OK, blocked: false, reason: null };
}

module.exports = { detectBlock, BLOCK_STATES };
