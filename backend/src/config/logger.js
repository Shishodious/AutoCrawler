/**
 * Structured application logger (pino).
 * Use logger.info/warn/error with an object first for structured fields:
 *   logger.info({ jobId }, 'job completed')
 */
const pino = require('pino');
const env = require('./env');

const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined // omit pid/hostname noise
});

module.exports = logger;
