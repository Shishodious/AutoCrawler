/**
 * Unit tests for the Zod request schemas.
 */
import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  crawlRequestSchema,
  recursiveCrawlRequestSchema
} from '../src/utils/validation.js';

describe('registerSchema', () => {
  it('accepts a strong password', () => {
    const r = registerSchema.safeParse({ username: 'alice', password: 'Str0ng!pass' });
    expect(r.success).toBe(true);
  });

  it('rejects passwords without special characters', () => {
    const r = registerSchema.safeParse({ username: 'alice', password: 'Str0ngpass' });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('blocks NoSQL operator injection by requiring strings', () => {
    const r = loginSchema.safeParse({ username: { $ne: null }, password: { $ne: null } });
    expect(r.success).toBe(false);
  });
});

describe('crawlRequestSchema', () => {
  it('applies option defaults when options are provided', () => {
    const r = crawlRequestSchema.parse({ url: 'https://example.com', options: {} });
    expect(r.options.maxDepth).toBe(0);
    expect(r.options.detectionThreshold).toBe(0.5);
  });

  it('rejects invalid URLs', () => {
    const r = crawlRequestSchema.safeParse({ url: 'not-a-url' });
    expect(r.success).toBe(false);
  });
});

describe('recursiveCrawlRequestSchema', () => {
  it('caps maxDepth at 5', () => {
    const r = recursiveCrawlRequestSchema.safeParse({
      url: 'https://example.com',
      options: { maxDepth: 9 }
    });
    expect(r.success).toBe(false);
  });
});
