/**
 * Centralized, validated environment configuration.
 * Loads .env and fails fast on missing/invalid values so the app can never
 * boot in a half-configured state. Require this before any other config.
 */
require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_DB_URI: z.string().min(1, 'MONGO_DB_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  CORS_ORIGINS: z
    .string()
    .default('https://auto-crawler.vercel.app,http://localhost:5173'),
  CRAWL_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  LOG_LEVEL: z.string().default('info'),
  LLM_MODEL: z.string().default('claude-sonnet-5'),
  // Crawler politeness & access (Track B)
  CRAWLER_USER_AGENT: z.string().default('AutoCrawlerBot'),
  CRAWLER_INFO_URL: z.string().default(''),
  CRAWL_MIN_HOST_INTERVAL_MS: z.coerce.number().int().min(0).max(60000).default(1000),
  STEALTH_ENABLED: z.string().optional(),
  PROXY_URLS: z.string().default(''), // comma-separated proxy URLs, rotated per request
  SESSION_ENC_KEY: z.string().optional(), // hex/base64 key for encrypting stored auth sessions
  N8N_ENABLED: z.string().optional(),
  N8N_WEBHOOK_URL: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ FATAL: Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// Comma-separated CORS_ORIGINS → array used by Express and Socket.IO
env.corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

module.exports = env;
