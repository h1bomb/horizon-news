# Automated News Site on Next.js (Horizon-fed) — Design

**Date:** 2026-07-09
**Status:** Approved (design phase)
**Target:** A self-hosted, SEO-friendly, statically-generated bilingual (EN/ZH) news site that consumes [Horizon](https://github.com/Thysrael/Horizon)'s daily Markdown briefings as its data source.

## 1. Goals & Non-Goals

### Goals
- Fully static HTML output (no running Node process required at serve time) for SEO and cheap self-hosting.
- Per-story article pages (one indexable URL per news item) plus daily-overview pages.
- Bilingual EN/ZH with correct hreflang.
- Resilient full-text extraction from original article URLs, with a clean fallback to summary-only.
- Decoupled from Horizon: Horizon runs unchanged; this project consumes its published `docs/*.md`.

### Non-Goals (deferred)
- Server-side or client-side full-text search (optional client-side fuzzy search is a soft add — see §10).
- Comments / user accounts / newsletter (Horizon already delivers email).
- Analytics (can add self-hosted Plausible later).
- Auto-translation beyond Horizon's EN/ZH output.
- ISR / on-demand revalidation (daily cron rebuild is the freshness model).

## 2. Context: Horizon's Output

Horizon is a Python AI news radar. It fetches from Hacker News, Reddit, Telegram, RSS, Twitter/X, GitHub, and OpenBB; scores each item 0–10 with an LLM; deduplicates; enriches with background context and community discussion; and emits bilingual daily briefings as Markdown.

Per Horizon's configuration docs:
> Horizon writes generated summaries to `data/summaries/` and copies publishable Markdown into `docs/` for the GitHub Pages site. The repository includes a ready-to-use workflow at `.github/workflows/daily-summary.yml`.

This project consumes the **publishable Markdown in Horizon's `docs/`** (EN + ZH daily briefings). Horizon is a public repo, so fetching `docs/` requires no authentication.

## 3. Architecture

Two independent repositories, two decoupled pipelines. The content worker and the Next.js site live together in this repo (`worker/` + site root); Horizon is a separate, unmodified upstream repo.

```
┌─ Horizon repo (unchanged) ─────────────────────────────────┐
│  GitHub Actions cron (daily-summary.yml)                   │
│  → fetch/score/enrich → commits docs/*.md (EN+ZH)          │
└────────────────────────┬───────────────────────────────────┘
                         │ public repo, sparse-checkout docs/
                         ▼
┌─ Content Worker (job, runs before build) ──────────────────┐
│  1. clone Horizon docs/                                    │
│  2. parse each daily briefing MD → Article records         │
│  3. for each: fetch+sanitize original full text            │
│     (robots.txt, rate-limit, cache, retry, fallback)       │
│  4. write normalized content store (JSON) → committed      │
└────────────────────────┬───────────────────────────────────┘
                         │ reads content/ as data source
                         ▼
┌─ Next.js site repo (App Router, output: 'export') ─────────┐
│  generateStaticParams → build all pages from content/      │
│  → next build (static HTML) → deploy to Nginx (Docker)     │
└─────────────────────────────────────────────────────────────┘
```

A scheduled job (GitHub Action or self-hosted runner) runs **Worker → build → deploy** once daily and on manual trigger.

### Why this shape
- **Decoupling:** Horizon stays stock; this project only reads its public Markdown.
- **Worker/build separation:** Full-text fetching is the slow, flaky step. Isolating it from `next build` makes the build deterministic and fast, makes fetching retryable/resumable, and lets the worker be re-run without redeploying.
- **Pure static output:** Honors the "static HTML, SEO-friendly" requirement and keeps self-hosting trivial (Nginx + static files).

## 4. Data Flow

1. Worker sparse-checkouts Horizon's `docs/` → daily briefing `.md` files (EN + ZH).
2. **Parser** reads each briefing and splits it into items via stable format anchors (title, summary block, tags, score, source links, discussion block, context block). Anchors are derived from real Horizon samples and pinned as test fixtures. Format drift fails tests loudly, not silently.
3. **Fetcher** resolves each item's `originalUrl`, fetches HTML, sanitizes it, and extracts main content / byline / excerpt / og image. Raw HTML is cached under `content-cache/<hash>.html` so retries don't re-download and builds are deterministic.
4. Worker writes the **content store** (§5) and commits it back to this repo (or writes to a shared volume on a self-hosted builder).
5. Next.js `generateStaticParams` reads the content store and pre-renders all pages.

## 5. Content Store (the shared contract)

The single interface between worker and site, and the primary test surface. Layout:

```
content/
  meta.json              # { lastBuiltAt, horizonCommit, counts, workerVersion }
  index.json             # lightweight list: id, slug, date, lang, title, score, tags, originalSite
  days/<YYYY-MM-DD>.json # day overview: date, lang, daySummary, articleIds[]
  articles/<id>.json     # full record (below)
```

`articles/<id>.json`:
```jsonc
{
  "id": "sha1(canonicalUrl + date)",     // stable across rebuilds
  "canonicalId": "sha1(canonicalUrl)",   // links EN<->ZH pairs for hreflang
  "slug": "openai-launches-gpt-x",
  "date": "2026-07-09",
  "publishedAt": "2026-07-09T08:30:00Z", // from fetched article, fallback to date
  "lang": "zh",
  "title": "...",
  "summary": "## ...",                   // markdown, from Horizon
  "score": 8.5,
  "tags": ["ai", "openai"],
  "sources": [
    { "platform": "hackernews", "url": "...", "points": 412 }
  ],
  "originalUrl": "https://...",
  "originalSite": "openai.com",
  "context": "...",                      // Horizon background, markdown
  "discussion": "...",                   // community discussion summary, markdown
  "image": "https://.../og.png",
  "fullText": {                          // nullable; null = summary-only render
    "html": "<p>...</p>",                // sanitized
    "byline": "Author Name",
    "excerpt": "...",
    "wordCount": 980,
    "fetchedAt": "2026-07-09T10:00:00Z",
    "status": "ok" | "fallback" | "failed"
  }
}
```

- The worker validates every record against a **zod** schema (`shared/schema.ts`); a non-conforming record fails the build rather than shipping.
- `id = hash(url + date)` keeps the same article in different daily briefings as separate pages (news is daily — intended).
- `canonicalId = hash(url)` enables cross-language and cross-day linking.
- `fullText: null` is the clean opt-out for full text (e.g. copyright concerns); the site renders summary + prominent original link.

## 6. Next.js Site Structure

App Router, `output: 'export'`. Bilingual via path prefix: `/zh/...` and `/en/...`. Root `/` is a static page that auto-redirects to the user's preferred language via the `Accept-Language` header at runtime (client-side JS redirect, since static export has no server) with a manual language switcher; default fallback `/zh`.

| Route | Source | Purpose |
|---|---|---|
| `/[lang]` (`/zh`, `/en`) | `meta.json` + latest `days/` | Homepage: today's top stories + recent days |
| `/[lang]/news/[slug]` | `articles/<id>.json` | Article detail (primary SEO page) |
| `/[lang]/day/[date]` | `days/<date>.json` | Daily overview |
| `/[lang]/tag/[tag]` | `index.json` filtered | Tag archive |
| `/[lang]/archive` | `index.json` grouped | Chronological archive |
| `/[lang]/about` | static | About page |
| `/feed-[lang].xml` | `index.json` | RSS feed |
| `/sitemap.xml`, `/robots.txt` | `index.json` | SEO basics |

`generateStaticParams` enumerates all slugs, dates, and tags for each lang. All routes are statically generated at build time.

## 7. SEO

- **Metadata** via `generateMetadata`: title, description (summary or `fullText.excerpt`), canonical URL, OpenGraph, Twitter Card.
- **JSON-LD `NewsArticle`** on article pages (`headline`, `datePublished`, `author`, `image`, `publisher`, `mainEntityOfPage`); `ItemList` on daily-overview pages.
- **hreflang:** EN/ZH pairs matched via `canonicalId`; each page emits `<link rel="alternate" hreflang>`. If a translation is missing, no hreflang is emitted (no dead links).
- **Sitemap** generated from `index.json`, `lastmod` from `publishedAt`, priority by score/freshness.
- **robots.txt:** allow all, reference sitemap; auxiliary routes (`/archive`) set `noindex` to avoid thin-content duplication.
- **Performance:** static HTML, `next/image` for og images, font optimization, code-splitting. Core Web Vitals target all-green (news SEO critical).

## 8. Error Handling & Resilience

- **Worker → parse failure:** a single briefing that fails to parse is logged and skipped; the rest continue. Zero successful parses fails the build.
- **Worker → fetch failure:** a failed `fullText` fetch sets `status: "fallback"`, `fullText: null` → page renders summary + prominent original link. Never blocks the build.
- **Worker → fetch robustness:** honor `robots.txt` (`robots-parser`), rate-limit per domain (~1 req/s), exponential backoff (3 retries), cache raw HTML in `content-cache/`. Paywalled/anti-bot sites fall back automatically.
- **Next.js → missing content:** `generateStaticParams` only enumerates existing records; stale links are impossible (content-driven). Empty `content/` fails the build fast with a clear message.
- **Upstream drift:** Horizon Markdown format change → parser snapshot test fails → notified. No silent bad data.
- **Reversibility:** worker and site are separate stages; the worker can be re-run without redeploying, and the site can be redeployed alone.

### Copyright note
Fetching full text introduces republication risk. Mitigations: prominent "阅读原文" link, byline attribution, source-site label, cached raw HTML for reprocessing. If unacceptable, set `fullText: null` globally and the site degrades to summary-only — a documented opt-out path.

## 9. Testing

- **Parser:** real Horizon sample briefings (EN + ZH) captured into `tests/fixtures/`. Snapshot tests assert the structured item output. Primary guard against upstream drift.
- **Schema:** zod validates every worker output record; tests prove malformed records are rejected.
- **Fetcher:** tests with fixture HTML (no network): main-content extraction, sanitize strips scripts/styles, fallback path, robots.txt blocking.
- **Site:** Vitest + render tests that article/day/tag pages render from a fixture content store; assert JSON-LD, hreflang, canonical, sitemap.xml, and feed.xml validity.
- **E2E (optional):** Playwright visits ~10 routes on the built output.

## 10. Tech Stack

- **Next.js 16** (App Router, `output: 'export'`, Turbopack) — latest (16.2.10 at time of writing). Scaffold with `pnpm create next-app@latest cms --yes` (App Router + TypeScript + Tailwind defaults), then set `output: 'export'` in `next.config`.
- **TypeScript** throughout.
- **Tailwind CSS** + **shadcn/ui** for clean UI.
- **react-markdown** + **rehype-sanitize** to render summary/discussion/context markdown safely.
- **Worker:** Node + TypeScript in `worker/`, sharing `shared/schema.ts` (zod) with the site. Uses `@extractus/article-extractor` (or Readability + `cheerio`), `robots-parser`, `zod`.
- **Deploy:** static `out/` served by `nginx:alpine` in a Docker image; self-hosted behind Cloudflare.

## 11. MVP Scope

**In scope:** homepage, article, day, tag, archive, about, RSS, sitemap, robots, JSON-LD, hreflang, dark mode, responsive design, worker CLI (`worker/run.ts`), Dockerfile + nginx config, CI workflow (worker → build → deploy), parser fixtures, zod schema + tests.

**Out of scope:** search, comments, newsletter, analytics, auto-translation beyond EN/ZH, user accounts.

**Soft add (default off):** client-side fuzzy search over `index.json` (e.g. Fuse.js), behind a `/[lang]/search` route. Decision: **exclude from MVP**; revisit as a follow-up after the core site ships.

## 12. Repo Layout (this repo)

```
cms/
  app/                    # Next.js App Router
  components/             # UI components
  lib/                    # site-side helpers (content loading, seo)
  content/                # generated content store (worker output, committed)
  content-cache/          # raw fetched HTML cache (gitignored)
  worker/                 # content worker CLI + modules
    parser/
    fetcher/
    run.ts
  shared/
    schema.ts             # zod schemas (shared by worker + site)
  tests/
    fixtures/             # real Horizon briefing samples
  docs/superpowers/specs/ # this design + future specs
  Dockerfile
  nginx.conf
  .github/workflows/
```
