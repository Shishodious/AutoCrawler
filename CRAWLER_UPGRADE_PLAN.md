# Core Crawler Upgrade Plan — from "link mapper" to "extraction engine"

**Goal:** Turn AutoCrawler from *"given a URL, return its links + meta tags"* into
*"point it at any page, get structured JSON fields + a readable report"* — and, as a
deliberate later escalation, reach defended targets that need stealth/auth.

**Where the code is today (grounded):**
- `extractPageData` (`utils/crawlerPuppeteer.js`) and `crawlWithAxios`
  (`utils/crawlerAxios.js`) extract only **title, meta tags, and `<a href>` links**.
  The readable body text is parsed then **discarded** (`analyzeContent` in
  `crawlerDetector.js` removes `script/style` to measure text length, but never keeps it).
- No structured-data parsing (JSON-LD / microdata / OpenGraph beyond a couple of og tags).
- No concept of "extract these fields." Every page → same `{title, links, metadata}` shape.
- Detector (`crawlerDetector.js`) only classifies **static vs JS-heavy**; it has no
  notion of *blocked / needs-auth / captcha*.
- `SiteData` model stores `metadata` + `links` + `crawlerStats`; no place for
  extracted content, entities, or a report.

**Design principle:** every phase reuses the engine you just built — the
hybrid Axios/Puppeteer router (`intelligentCrawl`) stays the fetch layer; new
work is a **post-fetch pipeline** (parse → extract → report) that runs on
whatever HTML the router returned. Cheap path fetches, expensive path renders,
then structure whatever came back.

---

# TRACK A — The Extraction Engine (build first)
*High value-per-effort. No anti-bot work. Works on friendly/consenting targets.*

## Phase A1 — Keep the content + parse the structured data sites hand you (0.5–1 wk)
*The foundation for everything below. Low effort, immediate payoff.*

| Task | Files | Notes |
|---|---|---|
| Stop discarding body content | `utils/crawlerPuppeteer.js` (`extractPageData`), `utils/crawlerAxios.js` | Return `rawHtml` (already in hand) + a cleaned text field alongside the existing shape. Non-breaking: additive fields. |
| Readability / main-content extraction | new `utils/extractors/content.js` (`@mozilla/readability` + `jsdom`, or `@extractus/article-extractor`) | Produce `{ contentText, contentHtml, wordCount, headings[], images[], publishedTime, author }`. This is the raw material for reports + LLM extraction. |
| Structured-data parser | new `utils/extractors/structuredData.js` | Parse `<script type="application/ld+json">`, microdata, and full OpenGraph/Twitter cards → normalized `structured` object (schema.org types: Article, Product, Person, Organization, Event, BreadcrumbList…). Most serious sites embed this — free, clean entities. |
| Wire into the pipeline | `utils/hybridCrawler.js` (`intelligentCrawl` result assembly) | After fetch, run content + structured-data extractors; attach `content` and `structured` to the crawl result. Gate behind an option so plain "map links" crawls can skip it. |
| Persist it | `models/SiteData.js`, `utils/validation.js` | Add `content` (text, wordCount, author, publishedTime) and `structured` (Mixed/subdoc) fields + matching Zod. Additive — existing docs stay valid. |
| Surface it | `frontend/src/pages/SessionDetails.jsx`, `components/CrawlDetailsExpand.jsx` | Show extracted content summary + structured entities in the existing detail view. |

**Acceptance:** crawl a blog post → get clean article text + author + publish date;
crawl a product page → get the schema.org Product (name, price, availability) with
zero site-specific config.

## Phase A2 — Schema-driven extraction: "I want THESE fields" (1–1.5 wk)
*Two modes: deterministic selectors, and LLM for anything.*

| Task | Files | Notes |
|---|---|---|
| Extraction request schema | `utils/validation.js` | New `extractRequestSchema`: `{ url, schema: {fields...}, mode: 'auto'\|'selectors'\|'llm', selectors? }`. `schema` is the target shape the user wants (e.g. name, headline, experience[]). |
| Selector extractor | new `utils/extractors/selectorExtractor.js` | Given `{field: cssSelector}` map → typed values via Cheerio. Deterministic, cheap, ideal for known/repeat sites. Supports arrays (repeated elements) + attribute extraction. |
| LLM extractor (the moat) | new `utils/extractors/llmExtractor.js` | Feed cleaned `contentText` + JSON Schema of desired fields to Claude (Anthropic SDK, `claude-sonnet-5` for cost/quality); use tool-use / structured output to force valid JSON back. Works on ANY page, no selectors. Truncate/chunk long pages; cache by (url, schemaHash). |
| Extraction templates | new `models/ExtractTemplate.js` | Saved, reusable `{name, domainPattern, schema, selectors}` per user — "LinkedIn-style profile", "product", "job posting". Turns one-off extraction into a repeatable product. |
| Extract endpoint | new route in `routes/crawlRoutes.js`: `POST /api/extract` | Enqueues an extract job (reuse the BullMQ queue from Phase 1 — add an `'extract'` job type in `worker/crawlProcessor.js`). Returns 202 + jobId, same async contract as crawl. |
| Worker support | `worker/crawlProcessor.js` | New `runExtract`: fetch via `intelligentCrawl` → content extract → dispatch to selector or LLM extractor by mode → persist result. |
| Frontend extract UI | new `frontend/src/pages/Extract.jsx` + nav entry | Field builder ("add field: name / type"), mode toggle, template picker, results as JSON + table. Reuse the queued/polling flow from Phase 1. |

**Acceptance:** paste a URL + "extract name, title, company, email" → get structured
JSON, whether or not the site is one you've seen before; save it as a template and
re-run on 10 similar URLs.

## Phase A3 — The report / output layer (0.5 wk)
*Makes output feel like a product, not a data dump.*

| Task | Files | Notes |
|---|---|---|
| Report generator | new `utils/report/generateReport.js` | Compose `content` + `structured` + extracted fields → a report object (summary, key facts, entities, links). Optional Claude summary pass. |
| Export formats | `routes/crawlRoutes.js` `GET /api/sites/:id/report?format=json\|md\|pdf` | JSON + Markdown cheap; PDF via a light renderer. This is also a Phase-5 SaaS "sellable surface" item — build once, reuse. |
| Frontend report view | `frontend/src/pages/SessionDetails.jsx` | Render the report; "Download" button. |

**Acceptance:** any crawled/extracted page can be downloaded as a clean
JSON/Markdown/PDF report.

---

# TRACK B — The Access / Anti-bot Tier (build later, deliberately)
*Expensive, never-finished arms race + legal exposure. Only for specific hard
targets that justify it. Gate behind ToS/AUP. Do NOT make this the MVP's identity.*

> **LinkedIn note:** LinkedIn requires auth, aggressively fingerprints bots, and
> its ToS forbids scraping (see the multi-year *hiQ v. LinkedIn* litigation —
> the state of the law is "contested," not "green light"). Treat it as the
> extreme end of this track, entered only with explicit user-provided
> authorization for accounts/data they're entitled to — never as a default target.

## Phase B1 — Detection of *blocked*, not just *JS-heavy* (0.5 wk)
| Task | Files | Notes |
|---|---|---|
| Block/challenge detector | `utils/crawlerDetector.js` (extend) | Recognize captchas, Cloudflare/Datadome interstitials, login walls, 403/429 patterns → new outcome states so the pipeline can react instead of returning garbage. |
| Surface block reason | `models/SiteData.js` `errorType` enum | Add `BLOCKED`, `AUTH_REQUIRED`, `CAPTCHA`. |

## Phase B2 — Stealth + politeness (1 wk)
| Task | Files | Notes |
|---|---|---|
| Stealth browser | `utils/crawlerPuppeteer.js` | `puppeteer-extra` + `stealth` plugin; randomized viewport/UA/headers; human-like timing. |
| Per-domain throttle + backoff | worker / queue | Token bucket in Redis per target host (pairs with Phase 3 politeness in the SaaS plan). |
| robots.txt + identity | new `utils/robots.js` | Respect robots by default; opt-out only for domains the user owns/authorizes. |

## Phase B3 — Proxies + authenticated sessions (1–1.5 wk)
| Task | Files | Notes |
|---|---|---|
| Proxy pool | new `config/proxies.js`, wire into both crawlers | Rotating residential/datacenter proxies via env config; per-request rotation + failure eviction. |
| Session/cookie injection | `utils/crawlerPuppeteer.js`, new `models/CrawlSession.js` (encrypted) | Let a user supply a cookie/session for a site they're entitled to access; inject before navigation. **Encrypt at rest; never log.** This is what makes login-walled targets reachable — deliberately, per-user, per-authorization. |
| AUP enforcement | route middleware | Block disallowed targets; require explicit authorization acknowledgement for auth-gated crawls. |

**Acceptance (track B):** the crawler correctly reports *why* a hard target
failed (blocked/auth/captcha) instead of returning empty; with stealth + a
user-supplied session, a consenting/authorized target that previously returned a
login wall now returns real content.

---

## Sequencing & rationale
1. **A1 → A2 → A3 first.** This is the whole product for most users and touches
   no anti-bot risk. A1 (JSON-LD + content) alone unlocks "profile/product/article
   report" for every site that *wants* to be read. A2's LLM extractor is the moat.
2. **Track B only after A ships and a real target demands it.** It's the
   expensive, legally-fraught, maintenance-heavy part; entering it early would
   sink the roadmap into cat-and-mouse instead of product.
3. Everything rides the **existing hybrid router + BullMQ queue** — extraction is
   a new job type and a post-fetch pipeline, not a rewrite.

**Rough timeline solo:** Track A ≈ 2.5–3 wk to a genuinely sellable extraction
product. Track B ≈ 2.5–3 wk more, and never truly "done."

## Dependencies to add
Track A: `@mozilla/readability` + `jsdom` (or `@extractus/article-extractor`),
`@anthropic-ai/sdk`, a PDF renderer (e.g. `pdfkit`).
Track B: `puppeteer-extra` + `puppeteer-extra-plugin-stealth`, a proxy provider SDK.

## How this plugs into the SaaS plan
- A2's extraction + A3's report/export = the **"actual sellable product surface"**
  (Phase 5 in `SAAS_UPGRADE_PLAN.md`) — API keys + exports now have something
  valuable to expose.
- B2's politeness/robots overlaps **Phase 3** of the SaaS plan — build once.
- LLM extraction implies **per-plan usage metering** (LLM tokens cost money) —
  ties directly to Phase 2 quotas.
