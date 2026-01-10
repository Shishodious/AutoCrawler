const z = require('zod');

// User registration schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character")
});

// URL validation schema
const urlSchema = z.string().url("Invalid URL format").trim();

// SiteData metadata schema
const metadataSchema = z.object({
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
  keywords: z.array(z.string().trim()).optional(),
  author: z.string().trim().optional(),
  ogImage: z.string().url("Invalid OG image URL").optional().or(z.literal('')),
  favicon: z.string().url("Invalid favicon URL").optional().or(z.literal('')),
  language: z.string().trim().optional(),
  contentType: z.string().trim().optional()
}).optional();

// Crawler stats schema
const crawlerStatsSchema = z.object({
  method: z.enum(['axios', 'puppeteer', 'hybrid'], {
    errorMap: () => ({ message: "Method must be 'axios', 'puppeteer', or 'hybrid'" })
  }),
  duration: z.number().min(0, "Duration cannot be negative"),
  depth: z.number().min(0, "Depth cannot be negative").max(10, "Depth cannot exceed 10"),
  statusCode: z.number().min(100, "Invalid HTTP status code").max(599, "Invalid HTTP status code").optional(),
  responseSize: z.number().min(0, "Response size cannot be negative").optional()
});

// SSL/TLS info schema
const sslInfoSchema = z.object({
  tlsVersion: z.enum(['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3', 'SSLv3', 'N/A'], {
    errorMap: () => ({ message: "Invalid TLS version" })
  }).optional(),
  certificateValid: z.boolean().nullable().optional(),
  certificateIssuer: z.string().trim().optional(),
  certificateExpiry: z.date().optional().or(z.string().datetime().transform(str => new Date(str)).optional()),
  protocol: z.enum(['http', 'https'], {
    errorMap: () => ({ message: "Protocol must be 'http' or 'https'" })
  })
});

// Create SiteData schema (for new site data entries)
const createSiteDataSchema = z.object({
  url: urlSchema,
  title: z.string().trim().min(1, "Title is required").max(500, "Title cannot exceed 500 characters"),
  links: z.array(urlSchema).optional().default([]),
  metadata: metadataSchema,
  crawlerStats: crawlerStatsSchema,
  sslInfo: sslInfoSchema,
  retryCount: z.number().min(0, "Retry count cannot be negative").max(10, "Retry count cannot exceed 10").optional().default(0),
  errorType: z.enum(['TIMEOUT', 'DNS_ERROR', 'CONNECTION_ERROR', 'SSL_ERROR', 'HTTP_ERROR', 'PARSE_ERROR', 'UNKNOWN', 'NONE']).optional().default('NONE'),
  errorMessage: z.string().max(500, "Error message cannot exceed 500 characters").optional(),
  crawlSuccess: z.boolean().optional().default(true),
  userId: z.string().optional() // MongoDB ObjectId as string
});

// Update SiteData schema (for updating existing entries - all fields optional)
const updateSiteDataSchema = z.object({
  url: urlSchema.optional(),
  title: z.string().trim().min(1, "Title cannot be empty").max(500, "Title cannot exceed 500 characters").optional(),
  links: z.array(urlSchema).optional(),
  metadata: metadataSchema,
  crawlerStats: crawlerStatsSchema.partial().optional(),
  sslInfo: sslInfoSchema.partial().optional(),
  retryCount: z.number().min(0, "Retry count cannot be negative").max(10, "Retry count cannot exceed 10").optional(),
  errorType: z.enum(['TIMEOUT', 'DNS_ERROR', 'CONNECTION_ERROR', 'SSL_ERROR', 'HTTP_ERROR', 'PARSE_ERROR', 'UNKNOWN', 'NONE']).optional(),
  errorMessage: z.string().max(500, "Error message cannot exceed 500 characters").optional(),
  crawlSuccess: z.boolean().optional()
}).partial();

// Error reporting schema
const errorReportSchema = z.object({
  errorType: z.enum(['TIMEOUT', 'DNS_ERROR', 'CONNECTION_ERROR', 'SSL_ERROR', 'HTTP_ERROR', 'PARSE_ERROR', 'UNKNOWN']),
  errorMessage: z.string().max(500, "Error message cannot exceed 500 characters")
});

// Query parameters schema for filtering site data
const siteDataQuerySchema = z.object({
  url: z.string().optional(),
  crawlSuccess: z.coerce.boolean().optional(), // Coerce string to boolean
  method: z.enum(['axios', 'puppeteer', 'hybrid']).optional(),
  errorType: z.enum(['TIMEOUT', 'DNS_ERROR', 'CONNECTION_ERROR', 'SSL_ERROR', 'HTTP_ERROR', 'PARSE_ERROR', 'UNKNOWN', 'NONE']).optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10), // Coerce string to number
  skip: z.coerce.number().min(0).optional().default(0) // Coerce string to number
}).partial();

// Crawl request schema for POST /api/crawl
const crawlRequestSchema = z.object({
  url: urlSchema,
  options: z.object({
    forceMethod: z.enum(['axios', 'puppeteer']).optional(),
    maxDepth: z.number().min(0).max(5).optional().default(0),
    detectionThreshold: z.number().min(0).max(1).optional().default(0.5),
    verbose: z.boolean().optional().default(false),
    maxPages: z.number().min(1).max(100).optional().default(50),
    delayMs: z.number().min(0).max(5000).optional().default(1500)
  }).optional().default({})
});

// Recursive crawl request schema for POST /api/crawl/recursive
const recursiveCrawlRequestSchema = z.object({
  url: urlSchema,
  options: z.object({
    // Recursive-specific options
    maxDepth: z.number().min(0).max(5).optional().default(3),
    maxPages: z.number().min(1).max(100).optional().default(50),
    childLinksPerPage: z.number().min(1).max(10).optional().default(3),
    delayMs: z.number().min(500).max(5000).optional().default(1500),
    sameDomainOnly: z.boolean().optional().default(true),
    verbose: z.boolean().optional().default(true),
    
    // intelligentCrawl options (passed through)
    forceMethod: z.enum(['axios', 'puppeteer']).optional(),
    detectionThreshold: z.number().min(0).max(1).optional().default(0.5),
    
    // Puppeteer-specific options
    blockResources: z.boolean().optional().default(true),
    autoScrollEnabled: z.boolean().optional().default(false),
    screenshot: z.boolean().optional().default(false)
  }).optional().default({})
});

module.exports = { 
  registerSchema,
  urlSchema,
  metadataSchema,
  crawlerStatsSchema,
  sslInfoSchema,
  createSiteDataSchema,
  updateSiteDataSchema,
  errorReportSchema,
  siteDataQuerySchema,
  crawlRequestSchema,
  recursiveCrawlRequestSchema
};
