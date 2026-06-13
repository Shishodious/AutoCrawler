/**
 * Centralized JWT secret.
 * Fails fast if JWT_SECRET is not configured so the app can never fall back
 * to a hardcoded, publicly-known secret (which would make tokens forgeable).
 */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Refusing to start with an insecure default.');
  process.exit(1);
}

module.exports = { JWT_SECRET };
