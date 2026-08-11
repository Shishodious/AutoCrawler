# AutoCrawler → SaaS Upgrade Plan

**Goal:** Take the current single-node crawler (4/10 SaaS-ready) to a credible paid MVP (~8/10).
**Strategy:** Sequence changes risk-first. Each phase is independently shippable and leaves the app working.

**Current state (grounded in code):**
- API: Express 5, all crawl routes in `backend/src/routes/crawlRoutes.js` (7 routes), auth in `authRoutes.js`.
- Crawls run **in-process** inside the request: `intelligentCrawl` / `recursiveCrawl` in `backend/src/utils/hybridCrawler.js` are `await`ed directly in the route handler → Puppeteer blocks the API event loop.
- Auth: `User` model is **username + password only** (`backend/src/models/User.js`), 1h JWT, no refresh, no email.
- No rate limiting, no helmet, no queue, no billing, no tests, no real health check (`/api/health` returns a hardcoded `"Connected"`).
- Multi-tenant scoping already exists via `userId` on `SiteData` — good foundation.

---

## Phase 0 — Safety net & hardening (0.5 week)
*Prereq for everything else. No user-facing change, but makes the rest shippable.*

| Task | Files | Notes |
|---|---|---|
| Add `helmet`, `express-rate-limit`, `compression` | `backend/src/index.js` | Global rate limit + a strict limiter on `/api/auth/*` (brute-force). |
| Real health check | new `backend/src/routes/healthRoutes.js` | Ping Mongo (`mongoose.connection.readyState`) + Redis; return 503 if down. Replace the hardcoded one. |
| Structured logging | new `backend/src/config/logger.js` (pino) | Replace `console.log` in hot paths; add request-id middleware. |
| Error tracking | Sentry (`@sentry/node`) in `index.js` | Capture unhandled + route errors. |
| Env validation on boot | new `backend/src/config/env.js` (zod) | Fail fast if `MONGO_URI`, `JWT_SECRET`, `REDIS_URL`, `STRIPE_*` missing — mirror the existing `jwt.js` pattern. |
| CORS from env, not hardcoded | `index.js`, `services/socketService.js` | `CORS_ORIGINS` env var; both places currently hardcode the two origins. |
| Minimal test harness | `backend/package.json`, `backend/tests/` | Vitest or Jest + supertest. Real `test` script (currently `echo "No tests"`). Start with auth + one crawl route. |

**Acceptance:** server boots only with valid env; auth endpoints rate-limited; `/api/health` reflects real DB/Redis; CI runs `npm test` green.

---

## Phase 1 — Queue-based crawl execution (1.5–2 weeks) 🔴 the core unlock
*This is the single most valuable change. Decouples Puppeteer from the API.*

**Architecture:**
```
API (Express)  ──enqueue job──►  Redis (BullMQ)  ──►  Worker process(es)
     │                                                      │
     │  return jobId immediately (202)                      │  run intelligentCrawl / recursiveCrawl
     │                                                      │  ONE shared Puppeteer pool, capped concurrency
     └──────────── Socket.IO progress ◄────────────────────┘  (worker emits via Redis pub/sub → API relays)
```

| Task | Files | Notes |
|---|---|---|
| Add Redis + BullMQ | `backend/package.json` (`bullmq`, `ioredis`) | New `backend/src/config/redis.js`. |
| Define queue + job schema | new `backend/src/queue/crawlQueue.js` | Job data: `{ userId, url, type: 'single'\|'recursive', options, socketId }`. |
| Worker entrypoint | new `backend/src/worker/index.js`, `backend/src/worker/crawlProcessor.js` | Separate process (`npm run worker`). Move the body of the current route handlers here — call the existing `intelligentCrawl`/`recursiveCrawl` unchanged, then persist `SiteData`. |
| Shared Puppeteer pool | refactor `backend/src/utils/crawlerPuppeteer.js` | Reuse one browser instance across jobs (launch once in worker); cap `Worker` concurrency (e.g. 3–5). Prevents the OOM risk. |
| Rewrite crawl routes to enqueue | `backend/src/routes/crawlRoutes.js` (`/crawl`, `/crawl/recursive`) | Return `202 { jobId }` instead of `await`ing the crawl. |
| Job status route | `crawlRoutes.js` new `GET /crawl/jobs/:jobId` | Query BullMQ job state. |
| Progress relay across processes | `services/socketService.js` | Worker publishes progress to Redis; API subscribes and relays to the user's socket. `emitCrawlEvent` becomes a Redis publish on the worker side. |
| Frontend: async flow | `frontend/src/pages/Home.jsx`, `services/socket.js`, `components/CrawlProgressPanel.jsx` | Submit → show "queued" → live progress → done. Mostly already wired for sockets; add the queued state. |
| Deploy | `backend/Dockerfile`, compose/`render.yaml` | Two services: `web` and `worker`, sharing Redis. |

**Acceptance:** submitting a crawl returns instantly; 10 concurrent recursive crawls don't block the API or crash the box; progress still streams live; killing the worker doesn't lose jobs (they retry).

---

## Phase 2 — Multi-tenant accounts & quotas (1 week)
*Turn "a login" into "an account with a plan."*

| Task | Files | Notes |
|---|---|---|
| Add email to accounts | `backend/src/models/User.js`, `authRoutes.js`, `utils/validation.js` | Add `email` (unique), keep username optional. Migration for existing users. |
| Email verification + password reset | new `backend/src/routes/authRoutes.js` endpoints + email service (Resend/Postmark) | Table stakes for real signups. |
| Refresh tokens | `authRoutes.js`, `middleware/authMiddleware.js` | Short access token + long refresh token (current 1h-only JWT is bad UX). |
| Plan/quota model | new `backend/src/models/Plan.js` or fields on `User` | `plan: free\|pro`, `crawlsThisMonth`, `monthlyLimit`, `maxDepth`, `maxConcurrent`, `resetAt`. |
| Quota enforcement middleware | new `backend/src/middleware/quotaMiddleware.js` | Runs before enqueue on `/crawl*`; 402/429 when over limit. Reset monthly via a cron. |
| Usage metering | increment on job completion (worker) | Source of truth for billing + dashboard. |

**Acceptance:** free users capped (e.g. 100 crawls/mo, depth ≤ 2, 1 concurrent); limits enforced at enqueue; usage visible via API.

---

## Phase 3 — Crawler politeness & legal guardrails (1 week) 🔴 don't skip
*A crawling SaaS that ignores this gets IP-banned and/or sued.*

| Task | Files | Notes |
|---|---|---|
| robots.txt respect | new `backend/src/utils/robots.js`, called in `hybridCrawler.js` before fetch | Fetch + cache robots per domain; skip disallowed paths (allow user opt-out only on domains they own). |
| Per-domain throttle | worker/queue level | Rate-limit requests per target host (BullMQ rate limiter or a token bucket in Redis). |
| Configurable User-Agent + contact | `crawlerAxios.js`, `crawlerPuppeteer.js` | Identify the bot; add a crawler info page. |
| Depth/page hard caps by plan | `recursiveCrawl` options | Wire plan limits from Phase 2 into the crawl options. |
| ToS / AUP + abuse reporting | frontend legal pages | Prohibit crawling you don't want liability for. |
| (Optional) egress IP rotation | infra | Proxy pool if you crawl at volume. |

**Acceptance:** disallowed paths are skipped; no single target host is hit faster than the configured rate; plan caps enforced in the crawl itself.

---

## Phase 4 — Billing (1 week)
| Task | Files | Notes |
|---|---|---|
| Stripe integration | new `backend/src/routes/billingRoutes.js`, `backend/src/config/stripe.js` | Checkout session + customer portal. |
| Webhooks | `billingRoutes.js` `POST /webhooks/stripe` (raw body) | On `checkout.completed` / `subscription.updated` → set `user.plan`; on cancel → downgrade. |
| Pricing page + upgrade flow | new `frontend/src/pages/Pricing.jsx`, `Billing.jsx` | Free / Pro tiers gated on Phase 2 quotas. |

**Acceptance:** a user can subscribe, plan updates via webhook, quotas change accordingly, cancel downgrades at period end.

---

## Phase 5 — The actual sellable product surface (1.5 weeks)
*What people pay for: programmatic access + data out, not "I crawled a page."*

| Task | Files | Notes |
|---|---|---|
| API keys | new `backend/src/models/ApiKey.js`, `middleware/apiKeyAuth.js` | Hashed keys; accept on crawl routes as an alternative to JWT. |
| Public REST API + docs | reuse `crawlRoutes.js` | Versioned `/api/v1`; OpenAPI spec. This is the product for many buyers. |
| Result export | `crawlRoutes.js` `GET /sites/export` | CSV / JSON / NDJSON of a session's `SiteData`. |
| Outbound webhooks | extend existing `utils/n8nTrigger.js` pattern | Generalize the n8n hook into per-user webhook subscriptions ("crawl finished → POST to your URL"). You already have the n8n email-crawler workflow as a template. |
| Scheduled / recurring crawls | new `backend/src/models/Schedule.js` + BullMQ repeatable jobs | "Monitor this site daily" — high-value, leans directly on Phase 1's queue. |

**Acceptance:** a user can create an API key, trigger a crawl via `curl`, export results, and schedule a recurring monitor.

---

## Sequencing & rationale
1. **Phase 0** first — you can't safely ship the rest without a test net, real health, and env validation.
2. **Phase 1** is the keystone (unblocks scale + Phase 5's scheduling). Do it before selling anything.
3. **Phases 2–4** convert it into a business (accounts → politeness → money).
4. **Phase 5** is the differentiator that justifies a subscription.

**Rough timeline solo:** ~7–8 focused weeks to an ~8/10 MVP.

## Positioning note
The market (ScrapingBee, Firecrawl, Browserless, Bright Data) is crowded on raw "crawl-as-a-service." Your edge is the **intelligent Axios↔Puppeteer detection** + a **niche**. The existing n8n *email-crawler* workflow suggests a natural wedge: **lead/contact extraction** or **site change-monitoring for SEO/metadata**. Picking the niche will raise the "is this a business" score more than any single feature — consider baking it into Phase 5 rather than shipping a generic crawler API.

## Dependency summary to add
`bullmq`, `ioredis`, `helmet`, `express-rate-limit`, `compression`, `pino`, `@sentry/node`, `stripe`, an email SDK (`resend`), `vitest` + `supertest`.
