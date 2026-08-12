/**
 * Authenticated-session encryption (AES-256-GCM).
 * Used to encrypt user-supplied auth cookies/sessions at rest. The key comes
 * from SESSION_ENC_KEY (hex or base64, 32 bytes). Never log plaintext sessions.
 */
const crypto = require('crypto');
const env = require('./../config/env');

function getKey() {
  const raw = env.SESSION_ENC_KEY;
  if (!raw) {
    const err = new Error('Session encryption unavailable: SESSION_ENC_KEY is not configured');
    err.code = 'ENC_UNAVAILABLE';
    throw err;
  }
  // Accept hex (64 chars) or base64
  let key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('SESSION_ENC_KEY must decode to 32 bytes (AES-256)');
  }
  return key;
}

function isEncryptionAvailable() {
  return Boolean(env.SESSION_ENC_KEY);
}

/** @returns {string} "iv:tag:ciphertext" (all base64) */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload) {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted payload');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, isEncryptionAvailable };
