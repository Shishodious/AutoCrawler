/**
 * Track B unit tests — block detection + session encryption.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { detectBlock, BLOCK_STATES } from '../src/utils/blockDetector.js';

describe('detectBlock', () => {
  it('flags HTTP 403 as blocked', () => {
    const r = detectBlock({ statusCode: 403, html: '<html>nope</html>' });
    expect(r.blocked).toBe(true);
    expect(r.state).toBe(BLOCK_STATES.BLOCKED);
  });

  it('flags HTTP 401 as auth required', () => {
    const r = detectBlock({ statusCode: 401 });
    expect(r.state).toBe(BLOCK_STATES.AUTH_REQUIRED);
  });

  it('flags HTTP 429 as rate limited', () => {
    const r = detectBlock({ statusCode: 429 });
    expect(r.state).toBe(BLOCK_STATES.RATE_LIMITED);
  });

  it('detects a captcha challenge in the page', () => {
    const r = detectBlock({ statusCode: 200, html: '<div class="g-recaptcha">Verify you are human</div>' });
    expect(r.state).toBe(BLOCK_STATES.CAPTCHA);
  });

  it('detects a Cloudflare interstitial', () => {
    const r = detectBlock({ statusCode: 200, title: 'Just a moment...', html: 'Checking your browser before accessing' });
    expect(r.state).toBe(BLOCK_STATES.BLOCKED);
  });

  it('detects a login wall on a thin page', () => {
    const r = detectBlock({ statusCode: 200, html: 'Please log in to continue', textLength: 50 });
    expect(r.state).toBe(BLOCK_STATES.AUTH_REQUIRED);
  });

  it('does NOT flag a normal page that merely has a login link', () => {
    const r = detectBlock({ statusCode: 200, html: 'Welcome. <a href="/login">Log in</a>. ' + 'content '.repeat(200), textLength: 2000 });
    expect(r.blocked).toBe(false);
    expect(r.state).toBe(BLOCK_STATES.OK);
  });
});

describe('session encryption', () => {
  beforeAll(() => {
    // 32-byte hex key for AES-256
    process.env.SESSION_ENC_KEY = '0'.repeat(64);
  });

  it('round-trips a cookie string and produces distinct ciphertext each time', async () => {
    const { encrypt, decrypt, isEncryptionAvailable } = await import('../src/utils/crypto.js');
    expect(isEncryptionAvailable()).toBe(true);
    const plain = 'session=abc123; token=xyz';
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a).not.toBe(b); // random IV per encryption
    expect(decrypt(a)).toBe(plain);
    expect(decrypt(b)).toBe(plain);
  });

  it('rejects a tampered payload', async () => {
    const { encrypt, decrypt } = await import('../src/utils/crypto.js');
    const enc = encrypt('secret');
    const [iv, tag, data] = enc.split(':');
    const tampered = `${iv}:${tag}:${Buffer.from('evil').toString('base64')}`;
    expect(() => decrypt(tampered)).toThrow();
  });
});
