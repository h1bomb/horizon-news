# Horizon-fed News Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted, statically-generated bilingual (EN/ZH) news site that consumes Horizon's daily Markdown briefings, extracts original full text, and serves SEO-friendly article/day/tag/archive pages from a JSON content store.

**Architecture:** Two decoupled stages in one repo. A Node/TypeScript **content worker** (`worker/`) sparse-checkouts Horizon's `docs/_posts/*.md`, parses each briefing into structured records, fetches+sanitizes original article full text, and writes a validated JSON **content store** (`content/`). A **Next.js 16** site (App Router, `output: 'export'`) reads that store at build time via `generateStaticParams` and emits static HTML served by Nginx in Docker. The single contract between worker and site is `shared/schema.ts` (zod).

**Tech Stack:** Next.js 16 (App Router, static export, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, zod, react-markdown + rehype-sanitize, @extractus/article-extractor, robots-parser, isomorphic-dompurify, gray-matter, vitest + @testing-library/react, Nginx (Docker), GitHub Actions.

## Global Constraints

- **Next.js 16.2.10**, App Router, `output: 'export'` in `next.config.ts` — every route must be statically generatable (no server runtime).
- **TypeScript** throughout, strict mode. **pnpm** is the package manager.
- **Bilingual EN/ZH** via path prefix `/[lang]/...`; root `/` client-redirects by `navigator.language` (fallback `/zh`).
- **Content store is the only worker→site interface.** Every record validated by zod (`shared/schema.ts`); non-conforming record fails the build.
- **IDs:** `id = sha1(originalUrl + date + lang)` (hex); `canonicalId = sha1(originalUrl)` (hex). Content store is lang-partitioned: `articles/<lang>/<id>.json`, `days/<lang>/<date>.json`.
- **Copyright opt-out:** `fullText: null` renders summary-only with a prominent original link. Never blocks the build.
- **Worker robustness:** honor `robots.txt`, rate-limit ~1 req/s per domain, 3 retries with exponential backoff, cache raw HTML in `content-cache/<hash>.html` (gitignored).
- **Upstream drift guard:** parser snapshot tests against real captured Horizon briefings in `tests/fixtures/`. Format change fails tests loudly.
- **No comments, search, accounts, analytics, newsletter, auto-translation, ISR** (out of MVP scope).
- **Commit frequently** — every task ends with a commit. Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`).

## File Structure

```
cms/
  app/
    layout.tsx                  # root layout (html, fonts, ThemeProvider)
    page.tsx                    # root "/" client redirect by navigator.language
    sitemap.ts                  # static sitemap.xml from index.json
    robots.ts                   # static robots.txt
    [lang]/
      layout.tsx                # lang layout: header/footer, language switcher
      page.tsx                  # homepage: today's top stories + recent days
      news/[slug]/
        page.tsx                # article detail (primary SEO page)
      day/[date]/
        page.tsx                # daily overview
      tag/[tag]/
        page.tsx                # tag archive
      archive/
        page.tsx                # chronological archive
      about/
        page.tsx                # static about page
  components/
    Header.tsx                  # top nav + language switcher + theme toggle
    Footer.tsx
    ArticleCard.tsx             # list item for an article
    ArticleBody.tsx             # renders summary/context/discussion markdown
    FullText.tsx                # renders sanitized fullText.html
    Markdown.tsx                # react-markdown + rehype-sanitize wrapper
    LanguageSwitcher.tsx        # client component, hreflang-based links
    ThemeToggle.tsx             # client component, dark mode
    DaySummary.tsx              # renders the day's "> From N items..." line
    TagList.tsx                 # renders tags as links
    EmptyState.tsx              # empty briefing render
  lib/
    content.ts                  # read content/ store (fs, build-time)
    seo.ts                      # generateMetadata helpers, JSON-LD builders
    hreflang.ts                 # find translation pair via canonicalId
    slug.ts                     # slugify helper (shared with worker via shared/)
  shared/
    schema.ts                   # zod schemas (Article, Day, Index, Meta)
    ids.ts                      # makeId, makeCanonicalId, sha1 hex
    slug.ts                     # slugify (re-exported; single impl)
  worker/
    parser/
      frontmatter.ts            # strip Jekyll front matter via gray-matter
      source-line.ts            # parse "platform · author · date · [Discussion](url)"
      references.ts             # parse <details><summary>References</summary> HTML
      parse.ts                  # main: briefing MD → ParsedItem[]
    fetcher/
      rate-limit.ts             # per-domain token-bucket ~1 req/s
      robots.ts                 # robots.txt fetch + isAllowed
      fetch.ts                  # fetch + cache + retry + backoff
      extract.ts                # article-extractor + DOMPurify + fallback
    clone.ts                    # sparse-checkout Horizon docs/_posts
    write-store.ts              # ParsedItem[] + fetched → content/ JSON files
    run.ts                      # CLI entry: clone → parse → fetch → write
  content/                      # generated content store (committed)
    meta.json
    index.json
    articles/<lang>/<id>.json
    days/<lang>/<date>.json
  content-cache/                # raw fetched HTML (gitignored)
  tests/
    fixtures/
      2026-07-08-summary-en.md  # real captured EN briefing
      2026-07-08-summary-zh.md  # real captured ZH briefing
      empty-en.md               # empty-day briefing
      sample-article.html       # fixture HTML for fetcher tests
      content/                  # minimal hand-built store for site tests
        meta.json
        index.json
        articles/en/<id>.json
        articles/zh/<id>.json
        days/en/2026-07-08.json
        days/zh/2026-07-08.json
    parser.test.ts
    source-line.test.ts
    references.test.ts
    schema.test.ts
    ids.test.ts
    slug.test.ts
    rate-limit.test.ts
    robots.test.ts
    fetch.test.ts
    extract.test.ts
    write-store.test.ts
    content.test.ts
    seo.test.ts
    hreflang.test.ts
    pages.test.tsx              # render tests for site routes
  public/
    feed-en.xml                 # generated by prebuild script
    feed-zh.xml
  scripts/
    generate-feeds.ts           # prebuild: writes public/feed-<lang>.xml
  Dockerfile
  nginx.conf
  .github/workflows/daily-build.yml
  docs/superpowers/{specs,plans}/
```

---

## Phase 1 — Foundation

### Task 1: Scaffold Next.js project + tooling

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.*`, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `AGENTS.md` (records lint/typecheck/test commands)

**Interfaces:**
- Produces: a building Next.js 16 static-export project with vitest configured; `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint` all runnable.

- [ ] **Step 1: Scaffold Next.js 16**

Run (uses defaults: App Router, TypeScript, Tailwind, ESLint, src/ directory **disabled** so `app/` is at root, import alias `@/*`):

```bash
pnpm create next-app@16.2.10 cms --yes --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm
```

If the current directory already is `cms/` (repo root), scaffold into a temp dir then move files in:

```bash
pnpm create next-app@16.2.10 . --yes --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm
```

- [ ] **Step 2: Enable static export**

Edit `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true, // static export: no Next image optimizer at runtime
  },
  trailingSlash: true, // Nginx serves /foo/index.html cleanly
};

export default nextConfig;
```

- [ ] **Step 3: Install runtime dependencies**

```bash
pnpm add zod gray-matter react-markdown remark-gfm rehype-sanitize @extractus/article-extractor robots-parser isomorphic-dompurify next-themes
```

- [ ] **Step 4: Install dev dependencies + initialize shadcn/ui**

```bash
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
pnpm dlx shadcn@latest init --yes --base-color neutral
```

Add shadcn components used across the site (each later task may add more):

```bash
pnpm dlx shadcn@latest add button card badge separator navigation-menu dropdown-menu skeleton --yes
```

- [ ] **Step 5: Configure vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./") },
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Add npm scripts + gitignore**

In `package.json`, ensure `scripts` includes:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "worker": "tsx worker/run.ts",
    "prebuild": "tsx scripts/generate-feeds.ts"
  }
}
```

Install `tsx` (dev dep, used to run TS scripts/worker):

```bash
pnpm add -D tsx
```

Ensure `.gitignore` contains (append if missing):

```
/content-cache/
/node_modules/
/.next/
/out/
*.log
.env
```

Note: `content/` is **committed** (it is the build's data source), so do NOT ignore it. `content-cache/` IS ignored.

- [ ] **Step 7: Replace default app/page.tsx with a placeholder root redirect**

Create `app/page.tsx`:

```tsx
export default function RootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting…</p>
    </main>
  );
}
```

(The real client redirect is built in Task 13; placeholder keeps the build green.)

- [ ] **Step 8: Record commands in AGENTS.md**

Create `AGENTS.md`:

```markdown
# Project Commands

- **Lint:** `pnpm lint`
- **Typecheck:** `pnpm typecheck`
- **Tests:** `pnpm test`
- **Build:** `pnpm build` (runs `prebuild` feed generation, then `next build` → `out/`)
- **Worker:** `pnpm worker` (regenerates `content/` from Horizon)
- **Dev:** `pnpm dev`
```

- [ ] **Step 9: Verify the foundation builds**

```bash
pnpm install
pnpm typecheck
pnpm build
```

Expected: `out/` directory produced, no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 static-export project with vitest + shadcn"
```

---

### Task 2: Shared zod schema + id/slug helpers

**Files:**
- Create: `shared/schema.ts`, `shared/ids.ts`, `shared/slug.ts`
- Test: `tests/schema.test.ts`, `tests/ids.test.ts`, `tests/slug.test.ts`

**Interfaces:**
- Produces: `ArticleSchema`, `DaySchema`, `IndexSchema`, `MetaSchema` (zod) + inferred TS types `Article`, `Day`, `Index`, `Meta`; `makeId(url, date, lang)`, `makeCanonicalId(url)`; `slugify(text)`. These are imported by every worker and site module.

- [ ] **Step 1: Write failing tests for ids + slug**

`tests/ids.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeId, makeCanonicalId } from "@/shared/ids";

describe("ids", () => {
  const url = "https://openai.com/index/introducing-gpt-live/";
  const date = "2026-07-08";

  it("makeId is stable and 40-char hex", () => {
    const id = makeId(url, date, "en");
    expect(id).toMatch(/^[0-9a-f]{40}$/);
    expect(makeId(url, date, "en")).toBe(id);
  });

  it("makeId differs by lang for the same url+date", () => {
    expect(makeId(url, date, "en")).not.toBe(makeId(url, date, "zh"));
  });

  it("makeCanonicalId is stable and lang-independent", () => {
    expect(makeCanonicalId(url)).toMatch(/^[0-9a-f]{40}$/);
    expect(makeCanonicalId(url)).toBe(makeCanonicalId(url));
  });
});
```

`tests/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/shared/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("OpenAI Launches GPT-Live")).toBe("openai-launches-gpt-live");
  });
  it("strips non-alphanumeric (keeps CJK)", () => {
    expect(slugify("欧盟即将重启消息扫描规则")).toBe("欧盟即将重启消息扫描规则");
  });
  it("collapses whitespace and trims", () => {
    expect(slugify("  Cloudflare   Meerkat  ")).toBe("cloudflare-meerkat");
  });
  it("falls back to a short hash when empty", () => {
    expect(slugify("!!!")).toMatch(/^item-[0-9a-f]{8}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/ids.test.ts tests/slug.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement ids + slug**

`shared/ids.ts`:

```ts
import { createHash } from "node:crypto";
import type { Lang } from "@/shared/schema";

export function sha1Hex(input: string): string {
  return createHash("sha1").update(input, "utf8").digest("hex");
}

export function makeCanonicalId(url: string): string {
  return sha1Hex(normalizeUrl(url));
}

export function makeId(url: string, date: string, lang: Lang): string {
  return sha1Hex(`${normalizeUrl(url)}|${date}|${lang}`);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}
```

`shared/slug.ts`:

```ts
import { createHash } from "node:crypto";

export function slugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (cleaned) return cleaned;
  return "item-" + createHash("sha1").update(text).digest("hex").slice(0, 8);
}
```

- [ ] **Step 4: Write failing schema tests**

`tests/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ArticleSchema, DaySchema, IndexSchema, MetaSchema } from "@/shared/schema";

const validArticle = {
  id: "a".repeat(40),
  canonicalId: "b".repeat(40),
  slug: "openai-launches-gpt-live",
  date: "2026-07-08",
  publishedAt: "2026-07-08T16:53:00Z",
  lang: "en",
  title: "OpenAI Launches GPT-Live",
  summary: "OpenAI has announced GPT-Live.",
  score: 8.0,
  tags: ["AI", "OpenAI"],
  sources: [{ platform: "hackernews", author: "logickkk1", discussionUrl: "https://news.ycombinator.com/item?id=48834405" }],
  originalUrl: "https://openai.com/index/introducing-gpt-live/",
  originalSite: "openai.com",
  context: "GPT-Live is a voice mode.",
  discussion: "Early access user simonw praised the feature.",
  references: [{ title: "GPT-Live", url: "https://openai.com/index/introducing-gpt-live/" }],
  image: null,
  fullText: null,
};

describe("ArticleSchema", () => {
  it("accepts a valid article with fullText null", () => {
    expect(ArticleSchema.safeParse(validArticle).success).toBe(true);
  });
  it("accepts a valid article with fullText ok", () => {
    expect(ArticleSchema.safeParse({ ...validArticle, fullText: {
      html: "<p>body</p>", byline: "Author", excerpt: "x", wordCount: 1,
      fetchedAt: "2026-07-08T10:00:00Z", status: "ok",
    } }).success).toBe(true);
  });
  it("rejects an unknown lang", () => {
    expect(ArticleSchema.safeParse({ ...validArticle, lang: "ja" }).success).toBe(false);
  });
  it("rejects score out of range", () => {
    expect(ArticleSchema.safeParse({ ...validArticle, score: 11 }).success).toBe(false);
  });
  it("rejects a malformed id", () => {
    expect(ArticleSchema.safeParse({ ...validArticle, id: "short" }).success).toBe(false);
  });
});

describe("DaySchema", () => {
  it("accepts a valid day", () => {
    expect(DaySchema.safeParse({
      date: "2026-07-08", lang: "en",
      daySummary: "From 40 items, 16 important content pieces were selected",
      articleIds: ["a".repeat(40)],
    }).success).toBe(true);
  });
});

describe("IndexSchema + MetaSchema", () => {
  it("accepts a valid index", () => {
    expect(IndexSchema.safeParse({
      articles: [{ id: "a".repeat(40), canonicalId: "b".repeat(40), slug: "x", date: "2026-07-08", lang: "en", title: "T", score: 8, tags: ["AI"], originalSite: "openai.com" }],
    }).success).toBe(true);
  });
  it("accepts a valid meta", () => {
    expect(MetaSchema.safeParse({
      lastBuiltAt: "2026-07-08T10:00:00Z", horizonCommit: "abc1234",
      counts: { articles: 16, days: 1, byLang: { en: 16, zh: 16 } },
      workerVersion: "0.1.0",
    }).success).toBe(true);
  });
});
```

- [ ] **Step 5: Run to verify failure**

```bash
pnpm test tests/schema.test.ts
```

Expected: FAIL — schema module not found.

- [ ] **Step 6: Implement the schema**

`shared/schema.ts`:

```ts
import { z } from "zod";

export const LangSchema = z.enum(["en", "zh"]);
export type Lang = z.infer<typeof LangSchema>;

export const SourceRefSchema = z.object({
  platform: z.string().min(1),
  author: z.string().optional(),
  discussionUrl: z.string().url().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ReferenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const FullTextSchema = z.object({
  html: z.string(),
  byline: z.string().nullable(),
  excerpt: z.string(),
  wordCount: z.number().int().nonnegative(),
  fetchedAt: z.string(),
  status: z.enum(["ok", "fallback", "failed"]),
});
export type FullText = z.infer<typeof FullTextSchema>;

export const HexId = z.string().regex(/^[0-9a-f]{40}$/);

export const ArticleSchema = z.object({
  id: HexId,
  canonicalId: HexId,
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publishedAt: z.string(),
  lang: LangSchema,
  title: z.string().min(1),
  summary: z.string(),
  score: z.number().min(0).max(10),
  tags: z.array(z.string()),
  sources: z.array(SourceRefSchema),
  originalUrl: z.string().url(),
  originalSite: z.string().min(1),
  context: z.string(),
  discussion: z.string(),
  references: z.array(ReferenceSchema),
  image: z.string().url().nullable(),
  fullText: FullTextSchema.nullable(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: LangSchema,
  daySummary: z.string(),
  articleIds: z.array(HexId),
});
export type Day = z.infer<typeof DaySchema>;

export const IndexArticleSchema = z.object({
  id: HexId,
  canonicalId: HexId,
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: LangSchema,
  title: z.string().min(1),
  score: z.number().min(0).max(10),
  tags: z.array(z.string()),
  originalSite: z.string().min(1),
});
export type IndexArticle = z.infer<typeof IndexArticleSchema>;

export const IndexSchema = z.object({
  articles: z.array(IndexArticleSchema),
});
export type Index = z.infer<typeof IndexSchema>;

export const MetaSchema = z.object({
  lastBuiltAt: z.string(),
  horizonCommit: z.string(),
  counts: z.object({
    articles: z.number().int().nonnegative(),
    days: z.number().int().nonnegative(),
    byLang: z.object({ en: z.number().int().nonnegative(), zh: z.number().int().nonnegative() }),
  }),
  workerVersion: z.string(),
});
export type Meta = z.infer<typeof MetaSchema>;
```

- [ ] **Step 7: Run all tests to verify pass**

```bash
pnpm test tests/schema.test.ts tests/ids.test.ts tests/slug.test.ts
```

Expected: PASS.

- [ ] **Step 8: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add shared/ tests/
git commit -m "feat: add zod content-store schema + id/slug helpers"
```

---

## Phase 2 — Worker: Parser

### Task 3: Capture real Horizon briefing fixtures

**Files:**
- Create: `tests/fixtures/2026-07-08-summary-en.md`, `tests/fixtures/2026-07-08-summary-zh.md`, `tests/fixtures/empty-en.md`

**Interfaces:**
- Produces: authentic, frozen briefing samples that every parser test snapshots against. These are the upstream-drift guard.

- [ ] **Step 1: Create the fixtures directory**

```bash
mkdir -p tests/fixtures
```

- [ ] **Step 2: Write the EN fixture**

Copy the real captured EN briefing into `tests/fixtures/2026-07-08-summary-en.md`. This is the authentic Horizon output (front matter + `> From 40 items…` + TOC + 16 items, each with `<a id="item-N">`, `## [title](url) ⭐️ score/10`, summary, source line, optional `**Background**:`, optional `<details><summary>References</summary>…</details>`, optional `**Discussion**:`, optional `**Tags**:`, `---`).

Use this representative 3-item excerpt (sufficient to exercise every field including a no-references item and a no-discussion item); the real file should contain the full captured briefing:

```
---
layout: default
title: "Horizon Summary: 2026-07-08 (EN)"
date: 2026-07-08
lang: en
---

> From 40 items, 16 important content pieces were selected

---

1. [EU close to reviving message scanning rules](#item-1) ⭐️ 9.0/10
2. [TypeScript 7.0 Announced with Up to 12x Speed Boost](#item-3) ⭐️ 9.0/10
3. [Critical Android remote root exploit chain disclosed](#item-4) ⭐️ 9.0/10

---

<a id="item-1"></a>
## [EU close to reviving message scanning rules](https://cyberinsider.com/eu-now-one-step-away-from-reviving-private-message-scanning-rules/) ⭐️ 9.0/10

The European Union is one step away from reviving proposed rules that would require scanning of private messages for child sexual abuse material, threatening the future of end-to-end encryption. If enacted, these rules could undermine privacy and encryption across the EU, affecting hundreds of millions of users and setting a dangerous precedent for mass surveillance.

hackernews · ggirelli · Jul 8, 16:53 · [Discussion](https://news.ycombinator.com/item?id=48834296)

**Background**: The EU's Chat Control regulation, formally the Child Sexual Abuse Regulation (CSAR), was proposed in May 2022 to combat child sexual abuse material.

<details><summary>References</summary>
<ul>
<li><a href="https://en.wikipedia.org/wiki/Chat_Control">Chat Control - Wikipedia</a></li>
<li><a href="https://edri.org/our-work/chat-control-what-is-actually-going-on/">Chat Control: What is actually going on? - EDRi</a></li>

</ul>
</details>

**Discussion**: Community comments express strong concerns about the persistent nature of this legislation.

**Tags**: `#privacy`, `#EU regulation`, `#surveillance`, `#encryption`, `#security`

---

<a id="item-2"></a>
## [TypeScript 7.0 Announced with Up to 12x Speed Boost](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) ⭐️ 9.0/10

Microsoft announced TypeScript 7.0, featuring a major compiler rewrite that delivers up to 12x faster build times across large codebases like VS Code, Sentry, and Playwright.

hackernews · DanRosenwasser · Jul 8, 16:06 · [Discussion](https://news.ycombinator.com/item?id=48833715)

**Background**: TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.

**Discussion**: The community praised the team for achieving massive speedups while maintaining compatibility.

**Tags**: `#TypeScript`, `#compiler`, `#performance`, `#JavaScript`, `#Microsoft`

---

<a id="item-3"></a>
## [Critical Android remote root exploit chain disclosed](https://www.coolapk.com/feed/72700258) ⭐️ 9.0/10

Nebula Security disclosed a remote root exploit chain targeting all Android versions, combining a Firefox browser vulnerability and a 15-year-old Linux kernel flaw.

telegram · zaihuapd · Jul 8, 13:01

**Background**: Android Debug Bridge (adb) is a command-line tool for debugging and managing Android devices.

<details><summary>References</summary>
<ul>
<li><a href="https://en.wikipedia.org/wiki/Android_Debug_Bridge">Android Debug Bridge - Wikipedia</a></li>

</ul>
</details>

**Tags**: `#Android`, `#security`, `#vulnerability`, `#root`, `#exploit`

---
```

> Note: TOC numbering is independent of `item-N` anchors (Horizon renumbers TOC sequentially but keeps its own item ids). The parser must read the anchor `id`, not rely on TOC order.

- [ ] **Step 3: Write the ZH fixture**

`tests/fixtures/2026-07-08-summary-zh.md` — the matching Chinese briefing. Same structure, `lang: zh`, `> 从 40 条内容中筛选出 16 条重要资讯。`, `**背景**:`, `<details><summary>参考链接</summary>…`, `**社区讨论**:`, `**标签**:`. Include the first item verbatim:

```
---
layout: default
title: "Horizon Summary: 2026-07-08 (ZH)"
date: 2026-07-08
lang: zh
---

> 从 40 条内容中筛选出 16 条重要资讯。

---

1. [欧盟即将重启消息扫描规则](#item-1) ⭐️ 9.0/10
2. [TypeScript 7.0 发布，速度提升高达 12 倍](#item-2) ⭐️ 9.0/10

---

<a id="item-1"></a>
## [欧盟即将重启消息扫描规则](https://cyberinsider.com/eu-now-one-step-away-from-reviving-private-message-scanning-rules/) ⭐️ 9.0/10

欧盟距离重启一项要求扫描私人消息以查找儿童性虐待素材的提案仅一步之遥，这对端到端加密的未来构成威胁。

hackernews · ggirelli · 7月8日 16:53 · [社区讨论](https://news.ycombinator.com/item?id=48834296)

**背景**: 欧盟的"聊天控制"法规，正式名称为《儿童性虐待法规》（CSAR），于 2022 年 5 月提出，旨在打击儿童性虐待素材。

<details><summary>参考链接</summary>
<ul>
<li><a href="https://en.wikipedia.org/wiki/Chat_Control">Chat Control - Wikipedia</a></li>

</ul>
</details>

**社区讨论**: 社区评论表达了对该立法持续存在的强烈担忧。

**标签**: `#privacy`, `#EU regulation`, `#surveillance`, `#encryption`, `#security`

---

<a id="item-2"></a>
## [TypeScript 7.0 发布，速度提升高达 12 倍](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) ⭐️ 9.0/10

微软宣布了 TypeScript 7.0，采用全新的编译器重写，在 VS Code、Sentry 和 Playwright 等大型代码库中构建速度提升高达 12 倍。

hackernews · DanRosenwasser · 7月8日 16:06 · [社区讨论](https://news.ycombinator.com/item?id=48833715)

**背景**: TypeScript 是 JavaScript 的类型化超集，可编译为纯 JavaScript。

**标签**: `#TypeScript`, `#compiler`, `#performance`, `#JavaScript`, `#Microsoft`

---
```

- [ ] **Step 4: Write the empty-day fixture**

`tests/fixtures/empty-en.md`:

```
---
layout: default
title: "Horizon Summary: 2026-07-09 (EN)"
date: 2026-07-09
lang: en
---

> Analyzed 25 items, but none met the importance threshold.

No significant developments today. This might indicate:
- A quiet day in your tracked sources
- The AI score threshold is too high
```

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/
git commit -m "test: capture real Horizon briefing fixtures (EN/ZH/empty)"
```

---

### Task 4: Front matter + header/TOC parsing

**Files:**
- Create: `worker/parser/frontmatter.ts`
- Test: `tests/parser.test.ts` (front matter portion — created here, extended in Tasks 5–6)

**Interfaces:**
- Consumes: `shared/schema.ts` (`Lang`).
- Produces: `stripFrontmatter(md): { body: string; lang: Lang; date: string }` — returns the Markdown body after the `---` front matter block, plus `lang`/`date` parsed from front matter (falling back to filename-derived values passed by caller).

- [ ] **Step 1: Write failing test**

`tests/parser.test.ts` (first slice):

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripFrontmatter } from "@/worker/parser/frontmatter";

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf8");
}

describe("stripFrontmatter", () => {
  it("strips Jekyll front matter and returns body + lang + date", () => {
    const { body, lang, date } = stripFrontmatter(fixture("2026-07-08-summary-en.md"));
    expect(lang).toBe("en");
    expect(date).toBe("2026-07-08");
    expect(body.startsWith("> From 40 items")).toBe(true);
    expect(body).not.toContain("layout: default");
  });

  it("parses zh front matter", () => {
    const { body, lang, date } = stripFrontmatter(fixture("2026-07-08-summary-zh.md"));
    expect(lang).toBe("zh");
    expect(date).toBe("2026-07-08");
    expect(body.startsWith("> 从 40 条内容")).toBe(true);
  });

  it("handles a briefing with no front matter (returns whole input)", () => {
    const md = "> From 1 items, 1 selected\n\n---\n";
    const { body, lang, date } = stripFrontmatter(md, "en", "2026-01-01");
    expect(body).toBe(md);
    expect(lang).toBe("en");
    expect(date).toBe("2026-01-01");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test tests/parser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/parser/frontmatter.ts`:

```ts
import matter from "gray-matter";
import { LangSchema, type Lang } from "@/shared/schema";

export interface FrontmatterResult {
  body: string;
  lang: Lang;
  date: string;
}

export function stripFrontmatter(
  md: string,
  fallbackLang: Lang = "en",
  fallbackDate = "1970-01-01",
): FrontmatterResult {
  const parsed = matter(md);
  const fm = parsed.data as Record<string, unknown>;
  const langParsed = LangSchema.safeParse(fm.lang ?? fallbackLang);
  const lang = langParsed.success ? langParsed.data : fallbackLang;
  const date = typeof fm.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fm.date) ? fm.date : fallbackDate;
  return { body: parsed.content.trim(), lang, date };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/parser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/parser/frontmatter.ts tests/parser.test.ts
git commit -m "feat(worker): strip Jekyll front matter from briefings"
```

---

### Task 5: Source-line + references parsers

**Files:**
- Create: `worker/parser/source-line.ts`, `worker/parser/references.ts`
- Test: `tests/source-line.test.ts`, `tests/references.test.ts`

**Interfaces:**
- Produces: `parseSourceLine(line, lang, briefingYear): { platform, author?, publishedAt, discussionUrl? }`; `parseReferences(html): Reference[]` (matching `shared/schema.ts` `Reference`).

- [ ] **Step 1: Write failing source-line test**

`tests/source-line.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSourceLine } from "@/worker/parser/source-line";

describe("parseSourceLine", () => {
  it("parses hackernews en with discussion", () => {
    const r = parseSourceLine("hackernews · ggirelli · Jul 8, 16:53 · [Discussion](https://news.ycombinator.com/item?id=48834296)", "en", 2026);
    expect(r.platform).toBe("hackernews");
    expect(r.author).toBe("ggirelli");
    expect(r.publishedAt).toBe("2026-07-08T16:53:00Z");
    expect(r.discussionUrl).toBe("https://news.ycombinator.com/item?id=48834296");
  });

  it("parses telegram en without discussion", () => {
    const r = parseSourceLine("telegram · zaihuapd · Jul 8, 13:01", "en", 2026);
    expect(r.platform).toBe("telegram");
    expect(r.author).toBe("zaihuapd");
    expect(r.publishedAt).toBe("2026-07-08T13:01:00Z");
    expect(r.discussionUrl).toBeUndefined();
  });

  it("parses rss with feed name and no author", () => {
    const r = parseSourceLine("rss · LWN.net · Jul 8, 13:14", "en", 2026);
    expect(r.platform).toBe("rss");
    expect(r.author).toBe("LWN.net");
    expect(r.publishedAt).toBe("2026-07-08T13:14:00Z");
  });

  it("parses reddit with subreddit", () => {
    const r = parseSourceLine("reddit · r/MachineLearning · /u/Savings-Display5123 · Jul 8, 17:58", "en", 2026);
    expect(r.platform).toBe("reddit");
    expect(r.author).toBe("/u/Savings-Display5123");
    expect(r.publishedAt).toBe("2026-07-08T17:58:00Z");
  });

  it("parses zh date with 月日", () => {
    const r = parseSourceLine("hackernews · ggirelli · 7月8日 16:53 · [社区讨论](https://news.ycombinator.com/item?id=48834296)", "zh", 2026);
    expect(r.platform).toBe("hackernews");
    expect(r.publishedAt).toBe("2026-07-08T16:53:00Z");
    expect(r.discussionUrl).toBe("https://news.ycombinator.com/item?id=48834296");
  });

  it("returns null publishedAt when no date present", () => {
    const r = parseSourceLine("rss · LWN.net", "en", 2026);
    expect(r.platform).toBe("rss");
    expect(r.publishedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing references test**

`tests/references.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseReferences } from "@/worker/parser/references";

describe("parseReferences", () => {
  it("parses a details block with links", () => {
    const html = `<details><summary>References</summary>\n<ul>\n<li><a href="https://en.wikipedia.org/wiki/Chat_Control">Chat Control - Wikipedia</a></li>\n<li><a href="https://edri.org/our-work/">EDRi</a></li>\n\n</ul>\n</details>`;
    const refs = parseReferences(html);
    expect(refs).toEqual([
      { title: "Chat Control - Wikipedia", url: "https://en.wikipedia.org/wiki/Chat_Control" },
      { title: "EDRi", url: "https://edri.org/our-work/" },
    ]);
  });

  it("returns [] when there is no details block", () => {
    expect(parseReferences("just some text")).toEqual([]);
  });

  it("ignores li items without an anchor", () => {
    const html = `<details><summary>References</summary>\n<ul>\n<li>no link here</li>\n<li><a href="https://x.com">X</a></li>\n</ul>\n</details>`;
    const refs = parseReferences(html);
    expect(refs).toEqual([{ title: "X", url: "https://x.com" }]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm test tests/source-line.test.ts tests/references.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement source-line parser**

`worker/parser/source-line.ts`:

```ts
import type { Lang } from "@/shared/schema";

export interface ParsedSourceLine {
  platform: string;
  author?: string;
  publishedAt: string | null; // ISO 8601 UTC, or null
  discussionUrl?: string;
}

const MONTHS_EN: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export function parseSourceLine(line: string, lang: Lang, year: number): ParsedSourceLine {
  const discussion = lang === "zh" ? /\[社区讨论\]\(([^)]+)\)/ : /\[Discussion\]\(([^)]+)\)/;
  const discMatch = line.match(discussion);
  const discussionUrl = discMatch?.[1];

  const withoutDisc = line.replace(discussion, "").trim().replace(/\s*·\s*$/, "");

  const parts = withoutDisc.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { platform: "unknown", publishedAt: null };

  const platform = parts[0];
  let author: string | undefined;
  let dateStr: string | null = null;

  // Find the date part (last part matching a date pattern) and treat the middle parts as author.
  if (lang === "zh") {
    const zhDate = parts.find((p) => /\d+月\d+日\s+\d{1,2}:\d{2}/.test(p));
    if (zhDate) {
      dateStr = zhDate;
      author = parts.slice(1, parts.indexOf(zhDate)).join(" · ") || undefined;
    } else {
      author = parts.slice(1).join(" · ") || undefined;
    }
  } else {
    const enDate = parts.find((p) => /^[A-Z][a-z]{2}\s+\d{1,2},\s*\d{1,2}:\d{2}$/.test(p));
    if (enDate) {
      dateStr = enDate;
      author = parts.slice(1, parts.indexOf(enDate)).join(" · ") || undefined;
    } else {
      author = parts.slice(1).join(" · ") || undefined;
    }
  }

  const publishedAt = dateStr ? toIso(dateStr, lang, year) : null;
  return { platform, author: author || undefined, publishedAt, discussionUrl };
}

function toIso(dateStr: string, lang: Lang, year: number): string | null {
  if (lang === "zh") {
    const m = dateStr.match(/(\d+)月(\d+)日\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const [, mo, d, h, mi] = m;
    return `${year}-${pad(+mo)}-${pad(+d)}T${pad(+h)}:${mi}:00Z`;
  }
  const m = dateStr.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, mon, d, h, mi] = m;
  const mo = MONTHS_EN[mon];
  if (!mo) return null;
  return `${year}-${pad(mo)}-${pad(+d)}T${pad(+h)}:${mi}:00Z`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
```

- [ ] **Step 5: Implement references parser**

`worker/parser/references.ts`:

```ts
import type { Reference } from "@/shared/schema";

const DETAILS_RE = /<details>\s*<summary>(.*?)<\/summary>\s*(.*?)\s*<\/details>/is;
const LI_RE = /<li>\s*(.*?)\s*<\/li>/gis;
const A_RE = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/is;

export function parseReferences(html: string): Reference[] {
  const block = html.match(DETAILS_RE);
  if (!block) return [];
  const listHtml = block[2];
  const refs: Reference[] = [];
  for (const li of listHtml.matchAll(LI_RE)) {
    const item = li[1];
    const a = item.match(A_RE);
    if (a) {
      const url = a[1].trim();
      const title = stripTags(a[2]).trim();
      if (title && url) refs.push({ title, url });
    }
  }
  return refs;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}
```

- [ ] **Step 6: Run to verify pass**

```bash
pnpm test tests/source-line.test.ts tests/references.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/parser/source-line.ts worker/parser/references.ts tests/source-line.test.ts tests/references.test.ts
git commit -m "feat(worker): parse briefing source line + references block"
```

---

### Task 6: Main briefing parser (items + empty case)

**Files:**
- Create: `worker/parser/parse.ts`
- Test: `tests/parser.test.ts` (extended — full snapshot)

**Interfaces:**
- Consumes: `stripFrontmatter`, `parseSourceLine`, `parseReferences`, `shared/schema.ts`, `shared/ids.ts`, `shared/slug.ts`.
- Produces: `parseBriefing(md, filename?): { date, lang, daySummary, items: ParsedItem[] }` where `ParsedItem` contains all `Article` fields except `image`/`fullText` (those are `null` until the fetcher runs) plus a `slugBase`. The worker's store writer adds uniqueness-suffixed slugs.

- [ ] **Step 1: Write failing test (extend tests/parser.test.ts)**

Append to `tests/parser.test.ts`:

```ts
import { parseBriefing } from "@/worker/parser/parse";

describe("parseBriefing", () => {
  it("parses the EN fixture into 3 items with all fields", () => {
    const { date, lang, daySummary, items } = parseBriefing(fixture("2026-07-08-summary-en.md"));
    expect(date).toBe("2026-07-08");
    expect(lang).toBe("en");
    expect(daySummary).toBe("From 40 items, 16 important content pieces were selected");
    expect(items.length).toBe(3);

    const first = items[0];
    expect(first.title).toBe("EU close to reviving message scanning rules");
    expect(first.originalUrl).toBe("https://cyberinserver.com/eu-now-one-step-away-from-reviving-private-message-scanning-rules/");
    expect(first.score).toBe(9.0);
    expect(first.tags).toEqual(["privacy", "EU regulation", "surveillance", "encryption", "security"]);
    expect(first.sources[0]).toEqual({
      platform: "hackernews",
      author: "ggirelli",
      discussionUrl: "https://news.ycombinator.com/item?id=48834296",
    });
    expect(first.publishedAt).toBe("2026-07-08T16:53:00Z");
    expect(first.context).toContain("Chat Control regulation");
    expect(first.discussion).toContain("strong concerns");
    expect(first.references.length).toBe(2);
    expect(first.references[0]).toEqual({ title: "Chat Control - Wikipedia", url: "https://en.wikipedia.org/wiki/Chat_Control" });
    expect(first.canonicalId).toMatch(/^[0-9a-f]{40}$/);
    expect(first.id).toMatch(/^[0-9a-f]{40}$/);
    expect(first.id).not.toBe(first.canonicalId);
  });

  it("parses item-2 with no references block", () => {
    const { items } = parseBriefing(fixture("2026-07-08-summary-en.md"));
    const ts = items.find((i) => i.title.includes("TypeScript 7.0"))!;
    expect(ts.references).toEqual([]);
    expect(ts.context).toContain("typed superset");
    expect(ts.discussion).toContain("speedups");
  });

  it("parses item-3 (telegram) with no discussion url", () => {
    const { items } = parseBriefing(fixture("2026-07-08-summary-en.md"));
    const android = items.find((i) => i.title.includes("Android remote root"))!;
    expect(android.sources[0].discussionUrl).toBeUndefined();
    expect(android.discussion).toBe("");
  });

  it("parses the ZH fixture", () => {
    const { date, lang, daySummary, items } = parseBriefing(fixture("2026-07-08-summary-zh.md"));
    expect(lang).toBe("zh");
    expect(daySummary).toBe("从 40 条内容中筛选出 16 条重要资讯。");
    expect(items.length).toBe(2);
    expect(items[0].title).toBe("欧盟即将重启消息扫描规则");
    expect(items[0].context).toContain("聊天控制");
    expect(items[0].references[0].url).toBe("https://en.wikipedia.org/wiki/Chat_Control");
  });

  it("detects the empty-day briefing and returns no items", () => {
    const { date, lang, daySummary, items } = parseBriefing(fixture("empty-en.md"));
    expect(items).toEqual([]);
    expect(daySummary).toBe("Analyzed 25 items, but none met the importance threshold.");
  });
});
```

> Replace the expected `originalUrl` host `cyberinsserver` typo above with the exact fixture URL `cyberinsider.com` to match the file you wrote in Task 3. Keep the test consistent with the fixture.

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test tests/parser.test.ts
```

Expected: FAIL — `parseBriefing` not found.

- [ ] **Step 3: Implement the main parser**

`worker/parser/parse.ts`:

```ts
import { stripFrontmatter } from "@/worker/parser/frontmatter";
import { parseSourceLine } from "@/worker/parser/source-line";
import { parseReferences } from "@/worker/parser/references";
import { makeId, makeCanonicalId } from "@/shared/ids";
import { slugify } from "@/shared/slug";
import type { Lang, Reference, SourceRef } from "@/shared/schema";

export interface ParsedItem {
  id: string;
  canonicalId: string;
  slugBase: string;
  date: string;
  publishedAt: string;
  lang: Lang;
  title: string;
  summary: string;
  score: number;
  tags: string[];
  sources: SourceRef[];
  originalUrl: string;
  originalSite: string;
  context: string;
  discussion: string;
  references: Reference[];
}

export interface ParsedBriefing {
  date: string;
  lang: Lang;
  daySummary: string;
  items: ParsedItem[];
}

const ITEM_ANCHOR_RE = /^<a id="item-(\d+)"><\/a>\s*$/;
const HEADING_RE = /^##\s+\[(.+?)\]\((https?:\/\/[^)]+)\)\s+⭐️\s+([\d.]+)\/10\s*$/;
const BG_RE_EN = /^\*\*Background\*\*:\s*(.*)$/s;
const BG_RE_ZH = /^\*\*背景\*\*:\s*(.*)$/s;
const DISC_RE_EN = /^\*\*Discussion\*\*:\s*(.*)$/s;
const DISC_RE_ZH = /^\*\*社区讨论\*\*:\s*(.*)$/s;
const TAGS_RE_EN = /^\*\*Tags\*\*:\s*(.*)$/;
const TAGS_RE_ZH = /^\*\*标签\*\*:\s*(.*)$/;
const DETAILS_RE = /<details>[\s\S]*?<\/details>/i;
const EMPTY_RE_EN = /Analyzed (\d+) items, but none met the importance threshold/;
const EMPTY_RE_ZH = /已分析 (\d+) 条内容，但没有达到重要性阈值的条目/;

export function parseBriefing(md: string, fallbackLang: Lang = "en", fallbackDate = "1970-01-01"): ParsedBriefing {
  const { body, lang, date } = stripFrontmatter(md, fallbackLang, fallbackDate);
  const year = parseInt(date.slice(0, 4), 10);

  const emptyRe = lang === "zh" ? EMPTY_RE_ZH : EMPTY_RE_EN;
  const emptyMatch = body.match(emptyRe);
  if (emptyMatch) {
    return { date, lang, daySummary: emptyMatch[0].replace(/^>\s*/, "").trim(), items: [] };
  }

  // Day summary = the leading "> ..." quote line.
  const summaryMatch = body.match(/^>\s*(.+?)$/m);
  const daySummary = summaryMatch ? summaryMatch[1].trim() : "";

  const items = parseItems(body, lang, date, year);
  return { date, lang, daySummary, items };
}

function parseItems(body: string, lang: Lang, date: string, year: number): ParsedItem[] {
  const lines = body.split("\n");
  const items: ParsedItem[] = [];
  let i = 0;
  const bgRe = lang === "zh" ? BG_RE_ZH : BG_RE_EN;
  const discRe = lang === "zh" ? DISC_RE_ZH : DISC_RE_EN;
  const tagsRe = lang === "zh" ? TAGS_RE_ZH : TAGS_RE_EN;

  while (i < lines.length) {
    const line = lines[i];
    if (ITEM_ANCHOR_RE.test(line)) {
      const blockEnd = findBlockEnd(lines, i + 1);
      const block = lines.slice(i + 1, blockEnd);
      items.push(buildItem(block, lang, date, year, bgRe, discRe, tagsRe));
      i = blockEnd;
      continue;
    }
    i++;
  }
  return items;
}

function findBlockEnd(lines: string[], start: number): number {
  for (let j = start; j < lines.length; j++) {
    if (lines[j].trim() === "---") return j;
  }
  return lines.length;
}

function buildItem(
  block: string[],
  lang: Lang,
  date: string,
  year: number,
  bgRe: RegExp,
  discRe: RegExp,
  tagsRe: RegExp,
): ParsedItem {
  const text = block.join("\n");
  const headingMatch = text.match(HEADING_RE);
  if (!headingMatch) throw new Error(`Could not parse item heading: ${text.slice(0, 80)}`);
  const [, title, url, scoreStr] = headingMatch;
  const score = parseFloat(scoreStr);

  const headingLineEnd = text.indexOf("\n");
  const afterHeading = text.slice(headingLineEnd + 1);

  const detailsMatch = afterHeading.match(DETAILS_RE);
  const withoutDetails = detailsMatch ? afterHeading.replace(detailsMatch[0], "") : afterHeading;

  const bgMatch = withoutDetails.match(bgRe);
  const discMatch = withoutDetails.match(discRe);
  const tagsMatch = withoutDetails.match(tagsRe);

  const context = bgMatch ? bgMatch[1].trim() : "";
  const discussion = discMatch ? discMatch[1].trim() : "";
  const tags = tagsMatch ? parseTags(tagsMatch[1]) : [];

  const references = detailsMatch ? parseReferences(detailsMatch[0]) : [];

  const summary = extractSummary(withoutDetails);
  const sourceLine = extractSourceLine(withoutDetails, lang, date, year);

  return {
    id: makeId(url, date, lang),
    canonicalId: makeCanonicalId(url),
    slugBase: slugify(title),
    date,
    publishedAt: sourceLine.publishedAt ?? `${date}T00:00:00Z`,
    lang,
    title: title.trim(),
    summary,
    score,
    tags,
    sources: [{ platform: sourceLine.platform, author: sourceLine.author, discussionUrl: sourceLine.discussionUrl }],
    originalUrl: url,
    originalSite: hostnameOf(url),
    context,
    discussion,
    references,
  };
}

function parseTags(raw: string): string[] {
  return raw.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
}

function extractSummary(text: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() !== "" && !HEADING_RE.test(l) && !l.startsWith("**") && !l.startsWith("<details"));
  if (start === -1) return "";
  const end = lines.findIndex((l, idx) => idx > start && /^[a-z]/i.test(l) && l.includes("·"));
  const summaryEnd = end === -1 ? lines.length : end;
  return lines.slice(start, summaryEnd).join("\n").trim();
}

function extractSourceLine(text: string, lang: Lang, date: string, year: number) {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => /^[a-z]/i.test(l.trim()) && l.includes("·"));
  if (idx === -1) return { platform: "unknown", publishedAt: null as string | null, author: undefined, discussionUrl: undefined };
  return parseSourceLine(lines[idx].trim(), lang, year);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/parser.test.ts
```

Expected: PASS. If the EN-fixture first-item URL assertion fails, correct the expected host in the test to exactly match the fixture (the parser reads the fixture verbatim).

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add worker/parser/parse.ts tests/parser.test.ts
git commit -m "feat(worker): main briefing parser with snapshot tests + empty-day detection"
```

---

## Phase 3 — Worker: Fetcher

### Task 7: Per-domain rate limiter + robots.txt checker

**Files:**
- Create: `worker/fetcher/rate-limit.ts`, `worker/fetcher/robots.ts`
- Test: `tests/rate-limit.test.ts`, `tests/robots.test.ts`

**Interfaces:**
- Produces: `RateLimiter` class with `async waitFor(url: string): Promise<void>` (token bucket, ~1 req/s per hostname); `isAllowed(url, robotsTxt)` and `async loadRobots(url): Promise<RobotChecker>` wrapping `robots-parser`.

- [ ] **Step 1: Write failing rate-limit test**

`tests/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/worker/fetcher/rate-limit";

describe("RateLimiter", () => {
  it("allows the first request immediately", async () => {
    const rl = new RateLimiter(1000);
    const t0 = Date.now();
    await rl.waitFor("https://example.com/a");
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it("delays a second request to the same domain by ~1s", async () => {
    const rl = new RateLimiter(1000);
    await rl.waitFor("https://example.com/a");
    const t0 = Date.now();
    await rl.waitFor("https://example.com/b");
    expect(Date.now() - t0).toBeGreaterThan(900);
  });

  it("does not delay across different domains", async () => {
    const rl = new RateLimiter(1000);
    await rl.waitFor("https://a.com/x");
    const t0 = Date.now();
    await rl.waitFor("https://b.com/x");
    expect(Date.now() - t0).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Write failing robots test**

`tests/robots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAllowed } from "@/worker/fetcher/robots";

const sampleTxt = `
User-agent: *
Disallow: /private/
Allow: /
`;

describe("isAllowed", () => {
  it("allows a path not disallowed", () => {
    expect(isAllowed("https://example.com/public/article", sampleTxt)).toBe(true);
  });
  it("disallows a disallowed path", () => {
    expect(isAllowed("https://example.com/private/secret", sampleTxt)).toBe(false);
  });
  it("treats a missing robots.txt as fully allowed", () => {
    expect(isAllowed("https://example.com/anything", "")).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm test tests/rate-limit.test.ts tests/robots.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement rate limiter**

`worker/fetcher/rate-limit.ts`:

```ts
export class RateLimiter {
  private lastRequest = new Map<string, number>();
  constructor(private readonly minIntervalMs: number = 1000) {}

  async waitFor(url: string): Promise<void> {
    const host = safeHost(url);
    if (!host) return;
    const now = Date.now();
    const last = this.lastRequest.get(host) ?? 0;
    const elapsed = now - last;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequest.set(host, Date.now());
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 5: Implement robots checker**

`worker/fetcher/robots.ts`:

```ts
import robotsParser from "robots-parser";

export function isAllowed(url: string, robotsTxt: string): boolean {
  if (!robotsTxt.trim()) return true;
  const base = `${new URL(url).protocol}//${new URL(url).hostname}`;
  const robots = robotsParser(`${base}/robots.txt`, robotsTxt);
  return robots.isAllowed(url) ?? true;
}

export interface RobotChecker {
  allowed(url: string): boolean;
  crawlDelay(url: string): number | undefined;
}

export async function loadRobots(url: string): Promise<RobotChecker> {
  const base = `${new URL(url).protocol}//${new URL(url).hostname}`;
  const robotsUrl = `${base}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { allowed: () => true, crawlDelay: () => undefined };
    const txt = await res.text();
    const robots = robotsParser(robotsUrl, txt);
    return {
      allowed: (u: string) => robots.isAllowed(u) ?? true,
      crawlDelay: (u: string) => robots.getCrawlDelay(u) ?? undefined,
    };
  } catch {
    return { allowed: () => true, crawlDelay: () => undefined };
  }
}
```

- [ ] **Step 6: Run to verify pass**

```bash
pnpm test tests/rate-limit.test.ts tests/robots.test.ts
```

Expected: PASS (the 1s delay test takes ~1s; that is expected).

- [ ] **Step 7: Commit**

```bash
git add worker/fetcher/rate-limit.ts worker/fetcher/robots.ts tests/rate-limit.test.ts tests/robots.test.ts
git commit -m "feat(worker): per-domain rate limiter + robots.txt checker"
```

---

### Task 8: HTTP fetch with cache + retry

**Files:**
- Create: `worker/fetcher/fetch.ts`
- Test: `tests/fetch.test.ts`

**Interfaces:**
- Produces: `fetchWithCache(url, { cacheDir, rateLimiter, robotsChecker }): Promise<{ status: number; html: string; fromCache: boolean }>` — checks `content-cache/<sha1(url)>.html`, honors robots + rate limit, retries 3× with exponential backoff, writes successful HTML to cache.

- [ ] **Step 1: Write failing test (uses a local http server, no external network)**

`tests/fetch.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchWithCache } from "@/worker/fetcher/fetch";
import { RateLimiter } from "@/worker/fetcher/rate-limit";

let server: Server;
let port: number;
let cacheDir: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><body><h1>Hi</h1></body></html>");
    } else if (req.url === "/fail") {
      res.writeHead(500);
      res.end("nope");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(0);
  await once(server, "listening");
  port = (server.address() as { port: number }).port;
  cacheDir = mkdtempSync(join(tmpdir(), "fc-"));
});

afterAll(() => {
  server.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

describe("fetchWithCache", () => {
  it("fetches and caches a successful page", async () => {
    const url = `http://localhost:${port}/ok`;
    const r = await fetchWithCache(url, { cacheDir, rateLimiter: new RateLimiter(1), robotsChecker: { allowed: () => true, crawlDelay: () => undefined } });
    expect(r.status).toBe(200);
    expect(r.html).toContain("<h1>Hi</h1>");
    expect(r.fromCache).toBe(false);
    // cache file written
    const r2 = await fetchWithCache(url, { cacheDir, rateLimiter: new RateLimiter(1), robotsChecker: { allowed: () => true, crawlDelay: () => undefined } });
    expect(r2.fromCache).toBe(true);
    expect(r2.html).toContain("<h1>Hi</h1>");
  });

  it("returns a 500 status after retries without caching", async () => {
    const url = `http://localhost:${port}/fail`;
    const r = await fetchWithCache(url, { cacheDir, rateLimiter: new RateLimiter(1), robotsChecker: { allowed: () => true, crawlDelay: () => undefined }, retries: 2, baseBackoffMs: 10 });
    expect(r.status).toBe(500);
    expect(r.fromCache).toBe(false);
  });

  it("skips fetching when robots disallows", async () => {
    const url = `http://localhost:${port}/ok`;
    const r = await fetchWithCache(url, { cacheDir, rateLimiter: new RateLimiter(1), robotsChecker: { allowed: () => false, crawlDelay: () => undefined } });
    expect(r.status).toBe(0);
    expect(r.html).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test tests/fetch.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/fetcher/fetch.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RateLimiter } from "@/worker/fetcher/rate-limit";
import type { RobotChecker } from "@/worker/fetcher/robots";

export interface FetchOptions {
  cacheDir: string;
  rateLimiter: RateLimiter;
  robotsChecker: RobotChecker;
  retries?: number;
  baseBackoffMs?: number;
  timeoutMs?: number;
}

export interface FetchResult {
  status: number; // 0 = skipped/not fetched
  html: string;
  fromCache: boolean;
}

export async function fetchWithCache(url: string, opts: FetchOptions): Promise<FetchResult> {
  const cacheFile = join(opts.cacheDir, `${createHash("sha1").update(url).digest("hex")}.html`);
  if (existsSync(cacheFile)) {
    return { status: 200, html: readFileSync(cacheFile, "utf8"), fromCache: true };
  }
  if (!opts.robotsChecker.allowed(url)) {
    return { status: 0, html: "", fromCache: false };
  }
  const retries = opts.retries ?? 3;
  const baseBackoff = opts.baseBackoffMs ?? 500;
  const timeout = opts.timeoutMs ?? 15000;

  let lastStatus = 0;
  for (let attempt = 0; attempt < retries; attempt++) {
    await opts.rateLimiter.waitFor(url);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "HorizonNewsBot/0.1 (+https://example.com/bot)" },
        signal: AbortSignal.timeout(timeout),
        redirect: "follow",
      });
      lastStatus = res.status;
      if (res.ok) {
        const html = await res.text();
        mkdirSync(opts.cacheDir, { recursive: true });
        writeFileSync(cacheFile, html, "utf8");
        return { status: 200, html, fromCache: false };
      }
    } catch {
      lastStatus = 0;
    }
    if (attempt < retries - 1) {
      await sleep(baseBackoff * 2 ** attempt);
    }
  }
  return { status: lastStatus, html: "", fromCache: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/fetch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/fetcher/fetch.ts tests/fetch.test.ts
git commit -m "feat(worker): HTTP fetch with cache, retry, robots+rate-limit integration"
```

---

### Task 9: Article extraction + sanitize + fallback

**Files:**
- Create: `worker/fetcher/extract.ts`, `tests/fixtures/sample-article.html`
- Test: `tests/extract.test.ts`

**Interfaces:**
- Consumes: `fetchWithCache` result HTML, `shared/schema.ts` (`FullText`).
- Produces: `extractArticle(html, url): Promise<FullText>` — uses `@extractus/article-extractor` then sanitizes with `isomorphic-dompurify`; on any failure returns `{ status: "fallback", html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt: <now>, }` (caller sets `fullText: null` for fallback per spec, but `status` is retained for diagnostics).

- [ ] **Step 1: Create a fixture HTML article**

`tests/fixtures/sample-article.html`:

```html
<!doctype html>
<html>
<head>
  <meta property="og:title" content="Sample Article">
  <meta property="og:image" content="https://example.com/og.png">
  <meta name="author" content="Jane Doe">
</head>
<body>
  <header><nav>Home About</nav></header>
  <main>
    <article>
      <h1>Sample Article</h1>
      <p>This is the first paragraph of the article body. It has enough words to be considered real content for extraction purposes.</p>
      <p>A second paragraph follows here with additional text to ensure the extractor recognizes the main content region correctly.</p>
      <script>var evil = "should be stripped";</script>
    </article>
  </main>
  <aside>Related posts</aside>
  <footer>Copyright 2026</footer>
</body>
</html>
```

- [ ] **Step 2: Write failing test**

`tests/extract.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractArticle } from "@/worker/fetcher/extract";

const html = readFileSync(resolve(__dirname, "fixtures", "sample-article.html"), "utf8");

describe("extractArticle", () => {
  it("extracts main content and strips scripts", async () => {
    const ft = await extractArticle(html, "https://example.com/sample");
    expect(ft.status).toBe("ok");
    expect(ft.html).toContain("first paragraph");
    expect(ft.html).not.toContain("evil");
    expect(ft.html).not.toContain("<script");
    expect(ft.wordCount).toBeGreaterThan(5);
    expect(ft.excerpt.length).toBeGreaterThan(0);
    expect(ft.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns fallback on empty html", async () => {
    const ft = await extractArticle("", "https://example.com/empty");
    expect(ft.status).toBe("fallback");
    expect(ft.html).toBe("");
    expect(ft.wordCount).toBe(0);
  });

  it("returns fallback on unparseable html", async () => {
    const ft = await extractArticle("<div><p>no article", "https://example.com/bad");
    expect(["fallback", "ok"]).toContain(ft.status);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm test tests/extract.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`worker/fetcher/extract.ts`:

```ts
import { extractFromHtml } from "@extractus/article-extractor";
import DOMPurify from "isomorphic-dompurify";
import type { FullText } from "@/shared/schema";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "b", "strong", "i", "em", "blockquote", "code", "pre", "br", "hr", "img", "figure", "figcaption", "span", "div"],
  ALLOWED_ATTR: ["href", "title", "alt", "src", "srcset"],
};

export async function extractArticle(html: string, url: string): Promise<FullText> {
  const fetchedAt = new Date().toISOString();
  if (!html || html.trim().length < 50) {
    return { html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt, status: "fallback" };
  }
  try {
    const article = await extractFromHtml(html, { url });
    if (!article || !article.content) {
      return { html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt, status: "fallback" };
    }
    const clean = DOMPurify.sanitize(article.content, SANITIZE_CONFIG);
    const text = clean.replace(/<[^>]+>/g, " ");
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const excerpt = (article.excerpt || text.slice(0, 160)).trim();
    return {
      html: clean,
      byline: article.author || null,
      excerpt,
      wordCount,
      fetchedAt,
      status: "ok",
    };
  } catch {
    return { html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt, status: "fallback" };
  }
}
```

- [ ] **Step 5: Run to verify pass**

```bash
pnpm test tests/extract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/fetcher/extract.ts tests/extract.test.ts tests/fixtures/sample-article.html
git commit -m "feat(worker): article extraction + DOMPurify sanitize + fallback"
```

---

## Phase 4 — Worker: Store writer + CLI

### Task 10: Content store writer

**Files:**
- Create: `worker/write-store.ts`
- Test: `tests/write-store.test.ts`

**Interfaces:**
- Consumes: `ParsedBriefing[]` + per-item `FullText | null` + `image: string | null` (from fetcher OG image) + `horizonCommit` + `workerVersion`.
- Produces: `writeContentStore(rootDir, briefings, enrichments, meta): Promise<void>` that writes `meta.json`, `index.json`, `days/<lang>/<date>.json`, `articles/<lang>/<id>.json`. Slug uniqueness: if two items in the same lang share a `slugBase`, append `-{id.slice(0,8)}`.

- [ ] **Step 1: Write failing test**

`tests/write-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeContentStore } from "@/worker/write-store";
import { parseBriefing } from "@/worker/parser/parse";
import type { ParsedBriefing } from "@/worker/parser/parse";
import type { Article, Index, Meta, Day } from "@/shared/schema";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "store-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function load(p: string) { return JSON.parse(readFileSync(join(dir, p), "utf8")); }

describe("writeContentStore", () => {
  it("writes meta, index, days, and article files with valid schemas", async () => {
    const en = parseBriefing(readFixtureEn(), "en", "2026-07-08");
    const zh = parseBriefing(readFixtureZh(), "zh", "2026-07-08");
    const briefings: ParsedBriefing[] = [en, zh];
    const enrichments = new Map<string, { fullText: Article["fullText"]; image: string | null }>();
    for (const b of briefings) for (const it of b.items) enrichments.set(it.id, { fullText: null, image: null });

    await writeContentStore(dir, briefings, enrichments, { horizonCommit: "abc1234", workerVersion: "0.1.0" });

    const meta = load("meta.json") as Meta;
    expect(meta.horizonCommit).toBe("abc1234");
    expect(meta.counts.articles).toBe(en.items.length + zh.items.length);
    expect(meta.counts.byLang.en).toBe(en.items.length);
    expect(meta.counts.byLang.zh).toBe(zh.items.length);

    const index = load("index.json") as Index;
    expect(index.articles.length).toBe(meta.counts.articles);
    expect(index.articles[0].slug).toBeTruthy();

    const day = load(`days/en/${en.date}.json`) as Day;
    expect(day.articleIds.length).toBe(en.items.length);
    expect(day.daySummary).toBe(en.daySummary);

    const art = load(`articles/en/${en.items[0].id}.json`) as Article;
    expect(art.id).toBe(en.items[0].id);
    expect(art.fullText).toBeNull();
    expect(art.image).toBeNull();
  });

  it("makes slugs unique within a lang by suffixing the short id", async () => {
    const en = parseBriefing(readFixtureEn(), "en", "2026-07-08");
    // Duplicate the first item to force a slug collision.
    const dup = { ...en, items: [en.items[0], { ...en.items[0], id: "c".repeat(40), title: en.items[0].title }] };
    const enrichments = new Map<string, { fullText: Article["fullText"]; image: string | null }>();
    for (const it of dup.items) enrichments.set(it.id, { fullText: null, image: null });
    await writeContentStore(dir, [dup], enrichments, { horizonCommit: "x", workerVersion: "0.1.0" });
    const index = load("index.json") as Index;
    const slugs = index.articles.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

function readFixtureEn() { return readFileSync(join(__dirname, "fixtures", "2026-07-08-summary-en.md"), "utf8"); }
function readFixtureZh() { return readFileSync(join(__dirname, "fixtures", "2026-07-08-summary-zh.md"), "utf8"); }
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test tests/write-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/write-store.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ArticleSchema, IndexSchema, MetaSchema, DaySchema, type Article, type Index, type Meta, type Day } from "@/shared/schema";
import type { ParsedBriefing, ParsedItem } from "@/worker/parser/parse";

export interface Enrichment {
  fullText: Article["fullText"];
  image: string | null;
}

export interface WriteMeta {
  horizonCommit: string;
  workerVersion: string;
}

export async function writeContentStore(
  rootDir: string,
  briefings: ParsedBriefing[],
  enrichments: Map<string, Enrichment>,
  meta: WriteMeta,
): Promise<void> {
  const slugCounts = new Map<string, number>(); // lang|slugBase -> count
  const articles: Article[] = [];
  const days: Day[] = [];

  for (const b of briefings) {
    const articleIds: string[] = [];
    for (const it of b.items) {
      const slug = uniqueSlug(it, b.lang, slugCounts);
      const enrich = enrichments.get(it.id) ?? { fullText: null, image: null };
      const article: Article = {
        id: it.id,
        canonicalId: it.canonicalId,
        slug,
        date: it.date,
        publishedAt: it.publishedAt,
        lang: it.lang,
        title: it.title,
        summary: it.summary,
        score: it.score,
        tags: it.tags,
        sources: it.sources,
        originalUrl: it.originalUrl,
        originalSite: it.originalSite,
        context: it.context,
        discussion: it.discussion,
        references: it.references,
        image: enrich.image,
        fullText: enrich.fullText,
      };
      const parsed = ArticleSchema.safeParse(article);
      if (!parsed.success) {
        throw new Error(`Invalid article ${it.id}: ${parsed.error.message}`);
      }
      writeArticle(rootDir, parsed.data);
      articles.push(parsed.data);
      articleIds.push(parsed.data.id);
    }
    const day: Day = { date: b.date, lang: b.lang, daySummary: b.daySummary, articleIds };
    const dayParsed = DaySchema.safeParse(day);
    if (!dayParsed.success) throw new Error(`Invalid day ${b.date}/${b.lang}: ${dayParsed.error.message}`);
    writeDay(rootDir, dayParsed.data);
    days.push(dayParsed.data);
  }

  const index: Index = { articles: articles.map((a) => ({
    id: a.id, canonicalId: a.canonicalId, slug: a.slug, date: a.date, lang: a.lang,
    title: a.title, score: a.score, tags: a.tags, originalSite: a.originalSite,
  })) };
  const indexParsed = IndexSchema.safeParse(index);
  if (!indexParsed.success) throw new Error(`Invalid index: ${indexParsed.error.message}`);
  writeFileSync(join(rootDir, "index.json"), JSON.stringify(indexParsed.data, null, 2), "utf8");

  const metaObj: Meta = {
    lastBuiltAt: new Date().toISOString(),
    horizonCommit: meta.horizonCommit,
    counts: {
      articles: articles.length,
      days: days.length,
      byLang: {
        en: articles.filter((a) => a.lang === "en").length,
        zh: articles.filter((a) => a.lang === "zh").length,
      },
    },
    workerVersion: meta.workerVersion,
  };
  const metaParsed = MetaSchema.safeParse(metaObj);
  if (!metaParsed.success) throw new Error(`Invalid meta: ${metaParsed.error.message}`);
  writeFileSync(join(rootDir, "meta.json"), JSON.stringify(metaParsed.data, null, 2), "utf8");
}

function uniqueSlug(it: ParsedItem, lang: string, counts: Map<string, number>): string {
  const key = `${lang}|${it.slugBase}`;
  const n = counts.get(key) ?? 0;
  counts.set(key, n + 1);
  if (n === 0) return it.slugBase;
  return `${it.slugBase}-${it.id.slice(0, 8)}`;
}

function writeArticle(rootDir: string, a: Article): void {
  const dir = join(rootDir, "articles", a.lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${a.id}.json`), JSON.stringify(a, null, 2), "utf8");
}

function writeDay(rootDir: string, d: Day): void {
  const dir = join(rootDir, "days", d.lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${d.date}.json`), JSON.stringify(d, null, 2), "utf8");
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/write-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/write-store.ts tests/write-store.test.ts
git commit -m "feat(worker): write validated content store (meta/index/days/articles)"
```

---

### Task 11: Worker CLI — Horizon clone + orchestrator

**Files:**
- Create: `worker/clone.ts`, `worker/run.ts`
- Test: `tests/run-orchestrate.test.ts` (unit test of the orchestration logic with stubbed clone/fetch; no network)

**Interfaces:**
- Produces: `pnpm worker` CLI that: sparse-checkouts Horizon's `docs/_posts` into a temp dir, parses every `*-summary-{en,zh}.md`, fetches full text for each item (robots+rate-limit+cache), writes the content store, and prints a summary. Accepts `--horizon-ref <ref>` (default `main`), `--no-fetch` (skip full-text fetching), `--limit <n>` (parse only N briefings, for dev).

- [ ] **Step 1: Implement clone helper**

`worker/clone.ts`:

```ts
import { execSync } from "node:child_process";
import { rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface CloneResult {
  postsDir: string;
  commit: string;
}

export function cloneHorizonPosts(targetDir: string, ref = "main"): CloneResult {
  if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
  execSync(`git init -q`, { cwd: targetDir });
  execSync(`git remote add origin https://github.com/Thysrael/Horizon.git`, { cwd: targetDir });
  execSync(`git config core.sparseCheckout true`, { cwd: targetDir });
  writeFileSync(join(targetDir, ".git", "info", "sparse-checkout"), "docs/_posts/*\n");
  execSync(`git fetch -q --depth 1 origin ${ref}`, { cwd: targetDir });
  execSync(`git checkout -q ${ref}`, { cwd: targetDir });
  const commit = execSync(`git rev-parse --short HEAD`, { cwd: targetDir }).toString().trim();
  return { postsDir: join(targetDir, "docs", "_posts"), commit };
}
```

- [ ] **Step 2: Implement the orchestrator**

`worker/run.ts`:

```ts
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseBriefing, type ParsedBriefing, type ParsedItem } from "@/worker/parser/parse";
import { writeContentStore, type Enrichment } from "@/worker/write-store";
import { cloneHorizonPosts } from "@/worker/clone";
import { RateLimiter } from "@/worker/fetcher/rate-limit";
import { loadRobots } from "@/worker/fetcher/robots";
import { fetchWithCache } from "@/worker/fetcher/fetch";
import { extractArticle } from "@/worker/fetcher/extract";
import { hostnameOf } from "@/worker/fetcher/hostname";

const ROOT = resolve(process.cwd());
const CACHE_DIR = join(ROOT, "content-cache");
const STORE_DIR = join(ROOT, "content");
const WORKER_VERSION = "0.1.0";

interface CliArgs {
  horizonRef: string;
  noFetch: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { horizonRef: "main", noFetch: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--horizon-ref") args.horizonRef = argv[++i];
    else if (argv[i] === "--no-fetch") args.noFetch = true;
    else if (argv[i] === "--limit") args.limit = parseInt(argv[++i], 10);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  console.log(`> Cloning Horizon docs/_posts @ ${args.horizonRef}…`);
  const tmp = join(CACHE_DIR, "_horizon");
  const { postsDir, commit } = cloneHorizonPosts(tmp, args.horizonRef);

  const files = readdirSync(postsDir).filter((f) => /-summary-(en|zh)\.md$/.test(f));
  const selected = args.limit ? files.slice(0, args.limit) : files;
  console.log(`> Found ${files.length} briefings, parsing ${selected.length}.`);

  const briefings: ParsedBriefing[] = [];
  for (const file of selected) {
    const md = readFileSync(join(postsDir, file), "utf8");
    const lang = file.endsWith("-en.md") ? "en" : "zh";
    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch?.[1] ?? "1970-01-01";
    try {
      briefings.push(parseBriefing(md, lang, date));
    } catch (e) {
      console.error(`! Failed to parse ${file}: ${(e as Error).message}`);
    }
  }

  if (briefings.length === 0) {
    throw new Error("No briefings parsed successfully — refusing to write an empty store.");
  }

  const enrichments = new Map<string, Enrichment>();
  const allItems = briefings.flatMap((b) => b.items);
  console.log(`> ${allItems.length} items across ${briefings.length} briefings.`);

  if (args.noFetch) {
    for (const it of allItems) enrichments.set(it.id, { fullText: null, image: null });
  } else {
    await enrichAll(allItems, enrichments);
  }

  console.log(`> Writing content store to ${STORE_DIR}…`);
  await writeContentStore(STORE_DIR, briefings, enrichments, { horizonCommit: commit, workerVersion: WORKER_VERSION });
  console.log("> Done.");
}

async function enrichAll(items: ParsedItem[], out: Map<string, Enrichment>): Promise<void> {
  const rateLimiter = new RateLimiter(1000);
  const robotsCache = new Map<string, Awaited<ReturnType<typeof loadRobots>>>();
  let ok = 0, fallback = 0, skipped = 0;

  for (const it of items) {
    try {
      const host = hostnameOf(it.originalUrl);
      if (!robotsCache.has(host)) robotsCache.set(host, await loadRobots(it.originalUrl));
      const robots = robotsCache.get(host)!;

      const result = await fetchWithCache(it.originalUrl, { cacheDir: CACHE_DIR, rateLimiter, robotsChecker: robots });
      if (result.status === 0) { skipped++; out.set(it.id, { fullText: null, image: null }); continue; }
      if (result.status !== 200) { fallback++; out.set(it.id, { fullText: null, image: null }); continue; }

      const fullText = await extractArticle(result.html, it.originalUrl);
      if (fullText.status === "fallback") { fallback++; out.set(it.id, { fullText: null, image: null }); }
      else { ok++; out.set(it.id, { fullText, image: extractOgImage(result.html) }); }
    } catch {
      fallback++;
      out.set(it.id, { fullText: null, image: null });
    }
  }
  console.log(`> Fetch: ${ok} ok, ${fallback} fallback, ${skipped} robots-blocked.`);
}

function extractOgImage(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add the small hostname helper used by run.ts**

`worker/fetcher/hostname.ts`:

```ts
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
```

- [ ] **Step 4: Write an orchestration unit test (no network — stub fetch)**

`tests/run-orchestrate.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBriefing } from "@/worker/parser/parse";
import { writeContentStore } from "@/worker/write-store";
import { mkdtempSync, rmSync, readFileSync as rd, existsSync } from "node:fs";
import { tmpdir } from "node:os";

vi.mock("@/worker/clone", () => ({
  cloneHorizonPosts: () => ({ postsDir: "", commit: "deadbeef" }),
}));

describe("worker orchestration (no network)", () => {
  it("parses fixtures and writes a store with fullText null under --no-fetch", async () => {
    const en = parseBriefing(readFileSync(join(__dirname, "fixtures", "2026-07-08-summary-en.md"), "utf8"), "en", "2026-07-08");
    const zh = parseBriefing(readFileSync(join(__dirname, "fixtures", "2026-07-08-summary-zh.md"), "utf8"), "zh", "2026-07-08");
    const dir = mkdtempSync(join(tmpdir(), "orch-"));
    const enrich = new Map<string, { fullText: null; image: null }>();
    for (const it of [...en.items, ...zh.items]) enrich.set(it.id, { fullText: null, image: null });
    await writeContentStore(dir, [en, zh], enrich, { horizonCommit: "deadbeef", workerVersion: "0.1.0" });
    expect(existsSync(join(dir, "meta.json"))).toBe(true);
    expect(existsSync(join(dir, "index.json"))).toBe(true);
    expect(existsSync(join(dir, "articles", "en", `${en.items[0].id}.json`))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 5: Run all worker tests + typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: PASS, no type errors.

- [ ] **Step 6: Smoke-run the worker against real Horizon (fetch disabled)**

```bash
pnpm worker --no-fetch --limit 4
```

Expected: `content/meta.json`, `content/index.json`, `content/articles/{en,zh}/*.json`, `content/days/{en,zh}/*.json` are produced from real briefings.

- [ ] **Step 7: Commit**

```bash
git add worker/clone.ts worker/run.ts worker/fetcher/hostname.ts tests/run-orchestrate.test.ts content/
git commit -m "feat(worker): clone Horizon posts + orchestrate parse/fetch/write CLI"
```

---

## Phase 5 — Site: Core

### Task 12: Fixture content store + content loaders

**Files:**
- Create: `tests/fixtures/content/{meta,index,days/en/2026-07-08,days/zh/2026-07-08,articles/en/*,articles/zh/*}.json`
- Create: `lib/content.ts`
- Test: `tests/content.test.ts`

**Interfaces:**
- Consumes: the content store layout from `shared/schema.ts`.
- Produces: `loadIndex()`, `loadMeta()`, `loadArticle(lang, id)`, `loadDay(lang, date)`, `listDays(lang)`, `listTags(lang)`, `findArticleBySlug(lang, slug)` — all read from `content/` (or a configurable root) at build time via `node:fs`. Also a `CONTENT_DIR` constant and `loadIndexFrom(root)` test overload.

- [ ] **Step 1: Build a minimal fixture content store (network-free)**

Generate the fixture store from the **committed `.md` fixtures** (Task 3) — not from a live Horizon clone — so the fixture is deterministic and buildable in CI without network. Create a one-off generator script `tests/fixtures/build-fixture-store.ts`:

```ts
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseBriefing, type ParsedBriefing } from "@/worker/parser/parse";
import { writeContentStore } from "@/worker/write-store";

const FIXTURE_DIR = resolve(__dirname);
const OUT_DIR = resolve(__dirname, "content");

async function main() {
  const briefings: ParsedBriefing[] = [];
  for (const file of readdirSync(FIXTURE_DIR)) {
    if (!/-summary-(en|zh)\.md$/.test(file)) continue;
    const lang = file.endsWith("-en.md") ? "en" : "zh";
    const date = file.match(/^(\d{4}-\d{2}-\d{2})/)![1];
    const md = readFileSync(join(FIXTURE_DIR, file), "utf8");
    briefings.push(parseBriefing(md, lang, date));
  }
  const enrich = new Map<string, { fullText: null; image: null }>();
  for (const b of briefings) for (const it of b.items) enrich.set(it.id, { fullText: null, image: null });
  await writeContentStore(OUT_DIR, briefings, enrich, { horizonCommit: "fixture", workerVersion: "0.1.0" });
  console.log(`> Wrote fixture content store to ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run it (it reads only local files, no network):

```bash
mkdir -p tests/fixtures/content
pnpm tsx tests/fixtures/build-fixture-store.ts
```

Verify `tests/fixtures/content/` now contains `meta.json`, `index.json`, `days/en/2026-07-08.json`, `days/zh/2026-07-08.json`, and at least one file under `articles/en/` and `articles/zh/`.

Commit this fixture store — it is the deterministic data source for every site test and does not change unless the `.md` fixtures change (re-run the script if they do).

- [ ] **Step 2: Write failing test**

`tests/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadIndexFrom, loadMetaFrom, loadArticleFrom, loadDayFrom, listDaysFrom, listTagsFrom, findArticleBySlugFrom } from "@/lib/content";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("content loaders", () => {
  it("loads index and meta", () => {
    const index = loadIndexFrom(FIXTURE);
    const meta = loadMetaFrom(FIXTURE);
    expect(index.articles.length).toBeGreaterThan(0);
    expect(meta.counts.articles).toBe(index.articles.length);
  });

  it("loads an article by lang+id", () => {
    const index = loadIndexFrom(FIXTURE);
    const first = index.articles[0];
    const art = loadArticleFrom(FIXTURE, first.lang, first.id);
    expect(art.id).toBe(first.id);
    expect(art.title).toBe(first.title);
  });

  it("finds an article by slug within a lang", () => {
    const index = loadIndexFrom(FIXTURE);
    const first = index.articles[0];
    const art = findArticleBySlugFrom(FIXTURE, first.lang, first.slug);
    expect(art?.id).toBe(first.id);
  });

  it("loads a day and lists days/tags", () => {
    const days = listDaysFrom(FIXTURE, "en");
    expect(days.length).toBeGreaterThan(0);
    const day = loadDayFrom(FIXTURE, "en", days[0]);
    expect(day.articleIds.length).toBeGreaterThan(0);
    const tags = listTagsFrom(FIXTURE, "en");
    expect(tags.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm test tests/content.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement loaders**

`lib/content.ts`:

```ts
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { IndexSchema, MetaSchema, ArticleSchema, DaySchema, type Index, type Meta, type Article, type Day, type Lang } from "@/shared/schema";

export const CONTENT_DIR = join(process.cwd(), "content");

export function loadIndex(): Index { return loadIndexFrom(CONTENT_DIR); }
export function loadMeta(): Meta { return loadMetaFrom(CONTENT_DIR); }
export function loadArticle(lang: Lang, id: string): Article { return loadArticleFrom(CONTENT_DIR, lang, id); }
export function loadDay(lang: Lang, date: string): Day { return loadDayFrom(CONTENT_DIR, lang, date); }
export function listDays(lang: Lang): string[] { return listDaysFrom(CONTENT_DIR, lang); }
export function listTags(lang: Lang): string[] { return listTagsFrom(CONTENT_DIR, lang); }
export function findArticleBySlug(lang: Lang, slug: string): Article | null { return findArticleBySlugFrom(CONTENT_DIR, lang, slug); }

export function loadIndexFrom(root: string): Index {
  return IndexSchema.parse(JSON.parse(readFileSync(join(root, "index.json"), "utf8")));
}
export function loadMetaFrom(root: string): Meta {
  return MetaSchema.parse(JSON.parse(readFileSync(join(root, "meta.json"), "utf8")));
}
export function loadArticleFrom(root: string, lang: Lang, id: string): Article {
  return ArticleSchema.parse(JSON.parse(readFileSync(join(root, "articles", lang, `${id}.json`), "utf8")));
}
export function loadDayFrom(root: string, lang: Lang, date: string): Day {
  return DaySchema.parse(JSON.parse(readFileSync(join(root, "days", lang, `${date}.json`), "utf8")));
}
export function listDaysFrom(root: string, lang: Lang): string[] {
  const dir = join(root, "days", lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}
export function listTagsFrom(root: string, lang: Lang): string[] {
  const index = loadIndexFrom(root);
  const set = new Set<string>();
  for (const a of index.articles) if (a.lang === lang) for (const t of a.tags) set.add(t);
  return [...set].sort();
}
export function findArticleBySlugFrom(root: string, lang: Lang, slug: string): Article | null {
  const index = loadIndexFrom(root);
  const hit = index.articles.find((a) => a.lang === lang && a.slug === slug);
  return hit ? loadArticleFrom(root, lang, hit.id) : null;
}
```

- [ ] **Step 5: Run to verify pass**

```bash
pnpm test tests/content.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/content.ts tests/content.test.ts tests/fixtures/content/ tests/fixtures/build-fixture-store.ts
git commit -m "feat(site): content store loaders + network-free fixture store for site tests"
```

---

### Task 13: Layouts, root redirect, header/footer, theme, language switcher

**Files:**
- Create: `app/layout.tsx`, `app/page.tsx` (real redirect), `app/[lang]/layout.tsx`, `components/Header.tsx`, `components/Footer.tsx`, `components/LanguageSwitcher.tsx`, `components/ThemeToggle.tsx`
- Modify: shadcn add `dropdown-menu` (already added in Task 1)

**Interfaces:**
- Produces: the bilingual shell. Root `/` client-redirects to `/zh` or `/en` via `navigator.language`. `app/[lang]/layout.tsx` validates `lang` is `en|zh`, renders `<Header>` (with `LanguageSwitcher` + `ThemeToggle`) and `<Footer>`. Theme via `next-themes` (`attribute="class"`).

- [ ] **Step 1: Root layout with theme provider**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Horizon Daily", template: "%s · Horizon Daily" },
  description: "AI-curated daily tech news, bilingual EN/ZH.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Root redirect page**

`app/page.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    const pref = navigator.language.toLowerCase();
    const lang = pref.startsWith("zh") ? "zh" : "en";
    router.replace(`/${lang}/`);
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-muted-foreground">
      Redirecting…
    </main>
  );
}
```

- [ ] **Step 3: Lang layout**

`app/[lang]/layout.tsx`:

```tsx
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { Lang } from "@/shared/schema";

const LANGS: Lang[] = ["en", "zh"];

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const langOk = lang === "en" || lang === "zh" ? (lang as Lang) : "en";
  return (
    <div className="flex min-h-screen flex-col">
      <Header lang={langOk} />
      <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) return {};
  return { html: { lang } };
}
```

> The layout passes `lang` to `Header`. Pages that render their own `<Header>` (homepage, article, day, tag, archive, about in later tasks) pass their `params.lang` directly; since the layout already renders a header, those per-page headers are redundant — pick **one** convention. Recommended: render `<Header>` **only in the layout** (remove per-page `<Header>` calls in Tasks 14–16). If a page needs a different header variant, keep the per-page call and remove it from the layout. Be consistent across all pages. The code in Tasks 14–16 shows `<Header>` per-page for explicitness; when implementing, delete those per-page `<Header>` calls and rely on the layout's header instead.

- [ ] **Step 4: Header with language switcher + theme toggle**

`components/Header.tsx` — a presentational component that receives `lang` as a prop (each page passes its `params.lang`; this avoids relying on `headers()`, which is not reliable in static export):

```tsx
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Lang } from "@/shared/schema";

export function Header({ lang }: { lang: Lang }) {
  const t = lang === "zh" ? { news: "资讯", archive: "归档", about: "关于" } : { news: "News", archive: "Archive", about: "About" };
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href={`/${lang}/`} className="text-lg font-semibold">Horizon Daily</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/${lang}/`} className="hover:underline">{t.news}</Link>
          <Link href={`/${lang}/archive/`} className="hover:underline">{t.archive}</Link>
          <Link href={`/${lang}/about/`} className="hover:underline">{t.about}</Link>
          <LanguageSwitcher lang={lang} />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
```

```tsx
export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const langOk = lang === "en" || lang === "zh" ? (lang as Lang) : "en";
  return (
    <div className="flex min-h-screen flex-col">
      <Header lang={langOk} />
      <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Footer**

`components/Footer.tsx`:

```tsx
export function Footer() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <p>Powered by Horizon · Next.js static export</p>
    </footer>
  );
}
```

- [ ] **Step 6: Language switcher (client, hreflang-based)**

`components/LanguageSwitcher.tsx`:

```tsx
"use client";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Lang } from "@/shared/schema";

export function LanguageSwitcher({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  function target(l: Lang): string {
    return pathname.replace(/^\/(en|zh)(\/|$)/, `/${l}$1`) || `/${l}/`;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">{lang === "zh" ? "中/EN" : "EN/中"}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><a href={target("en")} hrefLang="en">English</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={target("zh")} hrefLang="zh">中文</a></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 7: Theme toggle (client)**

`components/ThemeToggle.tsx`:

```tsx
"use client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? "☀" : "☾"}
    </Button>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
pnpm typecheck && pnpm build
```

Expected: `out/` produced with `out/en/index.html` and `out/zh/index.html` (index pages come from Task 14, so only the layout shell + root redirect render here; build should still succeed with empty lang pages if Task 14 is pending — otherwise expect a redirecting root `out/index.html`).

- [ ] **Step 9: Commit**

```bash
git add app/ components/ lib/
git commit -m "feat(site): root redirect + lang layout + header/footer + theme + language switcher"
```

---

### Task 14: Homepage + ArticleCard

**Files:**
- Create: `app/[lang]/page.tsx`, `components/ArticleCard.tsx`, `components/DaySummary.tsx`, `components/TagList.tsx`, `components/EmptyState.tsx`
- Test: `tests/pages.test.tsx` (homepage slice)

**Interfaces:**
- Consumes: `lib/content.ts` loaders.
- Produces: the homepage at `/[lang]/` — today's top stories (sorted by score desc) + links to recent days. `ArticleCard` renders a single article summary card (title link, score, source, tags, date).

- [ ] **Step 1: Create ArticleCard + small presentational components**

`components/ArticleCard.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TagList } from "@/components/TagList";
import type { Article, Lang } from "@/shared/schema";

export function ArticleCard({ article, lang }: { article: Article; lang: Lang }) {
  const href = `/${lang}/news/${article.slug}/`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href={href} className="text-lg font-semibold hover:underline">{article.title}</Link>
          <p className="text-sm text-muted-foreground">
            {article.originalSite} · ⭐️ {article.score}/10 · {article.date}
          </p>
        </div>
        <Badge variant="secondary">{article.score}/10</Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-sm">{stripMd(article.summary)}</p>
      <TagList tags={article.tags} lang={lang} />
    </Card>
  );
}

function stripMd(s: string): string {
  return s.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
}
```

`components/TagList.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/shared/schema";

export function TagList({ tags, lang }: { tags: string[]; lang: Lang }) {
  if (!tags.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Link key={t} href={`/${lang}/tag/${encodeURIComponent(t)}/`}>
          <Badge variant="outline">#{t}</Badge>
        </Link>
      ))}
    </div>
  );
}
```

`components/DaySummary.tsx`:

```tsx
export function DaySummary({ text }: { text: string }) {
  return <p className="mb-4 text-sm italic text-muted-foreground">{text}</p>;
}
```

`components/EmptyState.tsx`:

```tsx
export function EmptyState({ lang }: { lang: "en" | "zh" }) {
  const t = lang === "zh" ? "今日暂无重要动态。" : "No significant developments today.";
  return <p className="py-12 text-center text-muted-foreground">{t}</p>;
}
```

- [ ] **Step 2: Create the homepage**

`app/[lang]/page.tsx`:

```tsx
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";
import { DaySummary } from "@/components/DaySummary";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { loadIndex, loadDay, listDays } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const index = loadIndex();
  const items = index.articles.filter((a) => a.lang === langOk);
  const days = listDays(langOk);
  const today = days[0];
  const todayDay = today ? loadDay(langOk, today) : null;
  const todayArticles = items.filter((a) => a.date === today).sort((a, b) => b.score - a.score);
  const recentDays = days.slice(1, 6);

  return (
    <div className="space-y-8">
      <Header lang={langOk} />
      <section>
        <h1 className="mb-2 text-2xl font-bold">{langOk === "zh" ? "今日要闻" : "Today's Top Stories"}</h1>
        {todayDay && <DaySummary text={todayDay.daySummary} />}
        {todayArticles.length === 0 ? (
          <EmptyState lang={langOk} />
        ) : (
          <div className="space-y-4">
            {todayArticles.map((a) => <ArticleCard key={a.id} article={loadFull(a.id, langOk)} lang={langOk} />)}
          </div>
        )}
      </section>
      {recentDays.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-semibold">{langOk === "zh" ? "近期" : "Recent"}</h2>
          <ul className="flex flex-wrap gap-2">
            {recentDays.map((d) => (
              <li key={d}><Link href={`/${langOk}/day/${d}/`} className="text-sm text-primary hover:underline">{d}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import { loadArticle } from "@/lib/content";
function loadFull(id: string, lang: Lang) { return loadArticle(lang, id); }
```

> Move the `loadArticle` import to the top of the file in the real implementation; it is shown separately here only for clarity. The final file should have a single import block at the top.

- [ ] **Step 3: Write a render test for the homepage**

`tests/pages.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArticleCard } from "@/components/ArticleCard";
import { loadIndexFrom, loadArticleFrom } from "@/lib/content";
import { resolve } from "node:path";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("ArticleCard", () => {
  it("renders title, score, site, and tags", () => {
    const index = loadIndexFrom(FIXTURE);
    const first = index.articles.find((a) => a.lang === "en")!;
    const article = loadArticleFrom(FIXTURE, "en", first.id);
    const { getByText } = render(<ArticleCard article={article} lang="en" />);
    expect(getByText(article.title)).toBeTruthy();
    expect(getByText(/openai\.com|cyberinsider|devblogs/i)).toBeTruthy();
    article.tags.slice(0, 1).forEach((t) => expect(getByText(`#${t}`)).toBeTruthy());
  });
});
```

- [ ] **Step 4: Run tests + build**

```bash
pnpm test tests/pages.test.ts && pnpm build
```

Expected: tests PASS; `out/en/index.html` and `out/zh/index.html` produced with article cards.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/page.tsx components/ tests/pages.test.tsx
git commit -m "feat(site): homepage with today's top stories + recent days"
```

---

## Phase 6 — Site: Pages

### Task 15: Article page + Markdown renderer + full text

**Files:**
- Create: `app/[lang]/news/[slug]/page.tsx`, `components/Markdown.tsx`, `components/ArticleBody.tsx`, `components/FullText.tsx`
- Test: `tests/pages.test.tsx` (extended)

**Interfaces:**
- Consumes: `loadArticle`, `findArticleBySlug`, `lib/hreflang.ts` (from Task 17, stub here with a local lookup).
- Produces: the primary SEO article page. Renders title, score, source line, summary (markdown), context, discussion, references, optional `fullText.html` (sanitized), and a prominent "阅读原文 / Read original" link to `originalUrl`.

- [ ] **Step 1: Markdown renderer**

`components/Markdown.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Article body + full text**

`components/ArticleBody.tsx`:

```tsx
import { Markdown } from "@/components/Markdown";
import type { Article, Lang } from "@/shared/schema";

export function ArticleBody({ article, lang }: { article: Article; lang: Lang }) {
  const labels = lang === "zh"
    ? { background: "背景", discussion: "社区讨论", references: "参考链接", read: "阅读原文" }
    : { background: "Background", discussion: "Discussion", references: "References", read: "Read original" };
  return (
    <article className="space-y-6">
      <Markdown>{article.summary}</Markdown>
      {article.context && (
        <section><h2 className="text-lg font-semibold">{labels.background}</h2><Markdown>{article.context}</Markdown></section>
      )}
      {article.references.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{labels.references}</h2>
          <ul className="list-disc space-y-1 pl-6">
            {article.references.map((r) => <li key={r.url}><a href={r.url} className="text-primary hover:underline">{r.title}</a></li>)}
          </ul>
        </section>
      )}
      {article.discussion && (
        <section><h2 className="text-lg font-semibold">{labels.discussion}</h2><Markdown>{article.discussion}</Markdown></section>
      )}
      {article.fullText && <FullText html={article.fullText.html} />}
      <p><a href={article.originalUrl} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">→ {labels.read}</a></p>
    </article>
  );
}

import { FullText } from "@/components/FullText";
```

`components/FullText.tsx`:

```tsx
export function FullText({ html }: { html: string }) {
  return <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

> `fullText.html` was already sanitized by DOMPurify in the worker (Task 9). The site trusts the worker as the trust boundary. `Markdown` fields additionally use `rehype-sanitize` for defense in depth.

- [ ] **Step 3: Article page**

`app/[lang]/news/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ArticleBody } from "@/components/ArticleBody";
import { TagList } from "@/components/TagList";
import { loadIndex, loadArticle } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  const index = loadIndex();
  return index.articles.map((a) => ({ lang: a.lang, slug: a.slug }));
}

export default async function ArticlePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const index = loadIndex();
  const entry = index.articles.find((a) => a.lang === langOk && a.slug === slug);
  if (!entry) notFound();
  const article = loadArticle(langOk, entry.id);
  return (
    <div className="space-y-6">
      <Header lang={langOk} />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <p className="text-sm text-muted-foreground">
          {article.originalSite} · ⭐️ {article.score}/10 · {article.publishedAt.slice(0, 10)}
        </p>
        <TagList tags={article.tags} lang={langOk} />
      </header>
      <ArticleBody article={article} lang={langOk} />
    </div>
  );
}
```

- [ ] **Step 4: Extend render test**

Append to `tests/pages.test.tsx`:

```tsx
import { ArticleBody } from "@/components/ArticleBody";

describe("ArticleBody", () => {
  it("renders summary, background, references, and read-original link", () => {
    const index = loadIndexFrom(FIXTURE);
    const entry = index.articles.find((a) => a.lang === "en" && a.references?.length)!;
    const article = loadArticleFrom(FIXTURE, "en", entry.id);
    const { container, getByText } = render(<ArticleBody article={article} lang="en" />);
    expect(container.textContent).toContain(article.summary.slice(0, 20));
    expect(getByText("Background")).toBeTruthy();
    expect(getByText("Read original")).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run tests + build**

```bash
pnpm test tests/pages.test.ts && pnpm build
```

Expected: PASS; `out/en/news/<slug>/index.html` files produced for every article.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/news/ components/Markdown.tsx components/ArticleBody.tsx components/FullText.tsx tests/pages.test.tsx
git commit -m "feat(site): article page with markdown body + sanitized full text"
```

---

### Task 16: Day, Tag, Archive, About pages

**Files:**
- Create: `app/[lang]/day/[date]/page.tsx`, `app/[lang]/tag/[tag]/page.tsx`, `app/[lang]/archive/page.tsx`, `app/[lang]/about/page.tsx`
- Test: `tests/pages.test.tsx` (extended)

**Interfaces:**
- Produces: four routes. Day = all articles for a date (score desc) + day summary. Tag = all articles with that tag. Archive = all days grouped chronologically. About = static bilingual text.

- [ ] **Step 1: Day page**

`app/[lang]/day/[date]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";
import { DaySummary } from "@/components/DaySummary";
import { loadDay, loadArticle, listDays } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  const langs: Lang[] = ["en", "zh"];
  return langs.flatMap((lang) => listDays(lang).map((date) => ({ lang, date })));
}

export default async function DayPage({ params }: { params: Promise<{ lang: string; date: string }> }) {
  const { lang, date } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  if (!listDays(langOk).includes(date)) notFound();
  const day = loadDay(langOk, date);
  const articles = day.articleIds.map((id) => loadArticle(langOk, id)).sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-6">
      <Header lang={langOk} />
      <h1 className="text-2xl font-bold">{date}</h1>
      <DaySummary text={day.daySummary} />
      <div className="space-y-4">
        {articles.map((a) => <ArticleCard key={a.id} article={a} lang={langOk} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tag page**

`app/[lang]/tag/[tag]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";
import { loadIndex, loadArticle, listTags } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  const index = loadIndex();
  const langs: Lang[] = ["en", "zh"];
  const params: { lang: Lang; tag: string }[] = [];
  for (const lang of langs) {
    for (const a of index.articles) if (a.lang === lang) for (const t of a.tags) params.push({ lang, tag: t });
  }
  return params;
}

export default async function TagPage({ params }: { params: Promise<{ lang: string; tag: string }> }) {
  const { lang, tag } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const decoded = decodeURIComponent(tag);
  if (!listTags(langOk).includes(decoded)) notFound();
  const index = loadIndex();
  const matches = index.articles.filter((a) => a.lang === langOk && a.tags.includes(decoded));
  const articles = matches.map((m) => loadArticle(langOk, m.id)).sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-6">
      <Header lang={langOk} />
      <h1 className="text-2xl font-bold">#{decoded}</h1>
      <div className="space-y-4">
        {articles.map((a) => <ArticleCard key={a.id} article={a} lang={langOk} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Archive page**

`app/[lang]/archive/page.tsx`:

```tsx
import { Header } from "@/components/Header";
import Link from "next/link";
import { listDays, loadDay } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function ArchivePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const days = listDays(langOk).sort();
  return (
    <div className="space-y-6">
      <Header lang={langOk} />
      <h1 className="text-2xl font-bold">{langOk === "zh" ? "归档" : "Archive"}</h1>
      <ul className="space-y-2">
        {days.map((d) => {
          const day = loadDay(langOk, d);
          return (
            <li key={d} className="flex items-baseline gap-3">
              <Link href={`/${langOk}/day/${d}/`} className="font-medium hover:underline">{d}</Link>
              <span className="text-sm text-muted-foreground">{day.articleIds.length} {langOk === "zh" ? "条" : "stories"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: About page**

`app/[lang]/about/page.tsx`:

```tsx
import { Header } from "@/components/Header";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const content = langOk === "zh"
    ? { title: "关于", body: "本站由 Horizon 每日 AI 新闻雷达驱动，自动聚合 Hacker News、Reddit、Telegram、RSS 等来源的重要资讯，提供中英双语版本。所有页面为静态生成，适合自托管。" }
    : { title: "About", body: "This site is powered by Horizon, a daily AI news radar that aggregates important stories from Hacker News, Reddit, Telegram, RSS, and more, in English and Chinese. All pages are statically generated and self-hostable." };
  return (
    <div className="space-y-6">
      <Header lang={langOk} />
      <h1 className="text-2xl font-bold">{content.title}</h1>
      <p className="text-sm leading-relaxed">{content.body}</p>
    </div>
  );
}
```

- [ ] **Step 5: Run tests + build**

```bash
pnpm test && pnpm build
```

Expected: PASS; `out/{en,zh}/{day/<date>,tag/<tag>,archive,about}/index.html` produced.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/day/ app/[lang]/tag/ app/[lang]/archive/ app/[lang]/about/ tests/pages.test.tsx
git commit -m "feat(site): day, tag, archive, about pages"
```

---

## Phase 7 — SEO

### Task 17: Metadata + JSON-LD + hreflang

**Files:**
- Create: `lib/seo.ts`, `lib/hreflang.ts`
- Modify: `app/[lang]/news/[slug]/page.tsx`, `app/[lang]/day/[date]/page.tsx` (add `generateMetadata` + JSON-LD)
- Test: `tests/seo.test.ts`, `tests/hreflang.test.ts`

**Interfaces:**
- Produces: `buildArticleMetadata(article)`, `buildDayMetadata(day, lang)`, `newsArticleJsonLd(article)`, `itemListJsonLd(day, lang)`; `findTranslation(article): Article | null` (matches by `canonicalId` across langs).

- [ ] **Step 1: hreflang helper + test**

`lib/hreflang.ts`:

```ts
import { loadIndex, loadArticle } from "@/lib/content";
import type { Article, Lang } from "@/shared/schema";

export function findTranslation(article: Article): Article | null {
  const otherLang: Lang = article.lang === "en" ? "zh" : "en";
  const index = loadIndex();
  const match = index.articles.find((a) => a.lang === otherLang && a.canonicalId === article.canonicalId);
  return match ? loadArticle(otherLang, match.id) : null;
}
```

`tests/hreflang.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadIndexFrom, loadArticleFrom } from "@/lib/content";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("translation pairing", () => {
  it("finds the ZH pair of an EN article via canonicalId", () => {
    const index = loadIndexFrom(FIXTURE);
    const en = index.articles.find((a) => a.lang === "en")!;
    const zh = index.articles.find((a) => a.lang === "zh" && a.canonicalId === en.canonicalId);
    if (zh) {
      expect(zh.canonicalId).toBe(en.canonicalId);
      expect(zh.id).not.toBe(en.id);
    }
  });
});
```

- [ ] **Step 2: SEO builders + test**

`lib/seo.ts`:

```ts
import type { Metadata } from "next";
import type { Article, Day, Lang } from "@/shared/schema";
import { findTranslation } from "@/lib/hreflang";

const SITE = "https://example.com";

export function buildArticleMetadata(article: Article): Metadata {
  const description = article.fullText?.excerpt || stripMd(article.summary).slice(0, 160);
  const alternates: Record<string, string> = {};
  const tr = findTranslation(article);
  if (tr) alternates[tr.lang] = `/${tr.lang}/news/${tr.slug}/`;
  alternates[article.lang] = `/${article.lang}/news/${article.slug}/`;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/${article.lang}/news/${article.slug}/`, languages: alternates },
    openGraph: {
      title: article.title,
      description,
      url: `${SITE}/${article.lang}/news/${article.slug}/`,
      type: "article",
      images: article.image ? [{ url: article.image }] : undefined,
      publishedTime: article.publishedAt,
    },
    twitter: { card: "summary_large_image", title: article.title, description },
  };
}

export function buildDayMetadata(day: Day, lang: Lang): Metadata {
  return {
    title: lang === "zh" ? `${day.date} 日报` : `${day.date} Daily`,
    description: day.daySummary,
    alternates: { canonical: `/${lang}/day/${day.date}/` },
  };
}

export function newsArticleJsonLd(article: Article) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt,
    author: article.sources[0]?.author ? { "@type": "Person", name: article.sources[0].author } : undefined,
    image: article.image ? [article.image] : undefined,
    publisher: { "@type": "Organization", name: "Horizon Daily" },
    mainEntityOfPage: `${SITE}/${article.lang}/news/${article.slug}/`,
  };
}

export function itemListJsonLd(day: Day, lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: lang === "zh" ? `${day.date} 日报` : `${day.date} Daily`,
    itemListElement: day.articleIds.map((id, i) => ({
      "@type": "ListItem", position: i + 1, url: `${SITE}/${lang}/news/?id=${id}`,
    })),
  };
}

function stripMd(s: string): string {
  return s.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
}
```

`tests/seo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadIndexFrom, loadArticleFrom } from "@/lib/content";
import { buildArticleMetadata, newsArticleJsonLd } from "@/lib/seo";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("seo builders", () => {
  it("builds article metadata with canonical + description", () => {
    const index = loadIndexFrom(FIXTURE);
    const article = loadArticleFrom(FIXTURE, "en", index.articles[0].id);
    const md = buildArticleMetadata(article);
    expect(md.title).toBe(article.title);
    expect(md.alternates?.canonical).toBe(`/en/news/${article.slug}/`);
    expect(md.openGraph?.type).toBe("article");
  });

  it("builds NewsArticle JSON-LD with required fields", () => {
    const index = loadIndexFrom(FIXTURE);
    const article = loadArticleFrom(FIXTURE, "en", index.articles[0].id);
    const ld = newsArticleJsonLd(article);
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.headline).toBe(article.title);
    expect(ld.datePublished).toBe(article.publishedAt);
    expect(ld.mainEntityOfPage).toContain("/en/news/");
  });
});
```

- [ ] **Step 3: Wire metadata + JSON-LD into the article page**

Edit `app/[lang]/news/[slug]/page.tsx` — add `export async function generateMetadata(...)` and render a JSON-LD script:

```tsx
import { buildArticleMetadata, newsArticleJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const index = loadIndex();
  const entry = index.articles.find((a) => a.lang === langOk && a.slug === slug);
  if (!entry) return {};
  return buildArticleMetadata(loadArticle(langOk, entry.id));
}
```

And inside the page component's return, add before `</div>`:

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd(article)) }} />
```

Do the same for the day page using `buildDayMetadata` + `itemListJsonLd`.

- [ ] **Step 4: Run tests + build**

```bash
pnpm test tests/seo.test.ts tests/hreflang.test.ts && pnpm build
```

Expected: PASS; built article HTML contains `application/ld+json` and `<link rel="canonical">`.

- [ ] **Step 5: Commit**

```bash
git add lib/seo.ts lib/hreflang.ts app/[lang]/news/[slug]/page.tsx app/[lang]/day/[date]/page.tsx tests/seo.test.ts tests/hreflang.test.ts
git commit -m "feat(seo): generateMetadata + NewsArticle/ItemList JSON-LD + hreflang"
```

---

### Task 18: Sitemap, robots, RSS feeds

**Files:**
- Create: `app/sitemap.ts`, `app/robots.ts`, `scripts/generate-feeds.ts`
- Test: `tests/feeds.test.ts`

**Interfaces:**
- Produces: `out/sitemap.xml` (all article/day/tag/archive URLs with `lastmod` = `publishedAt`), `out/robots.txt` (allow all, reference sitemap, `noindex` for `/archive`), `public/feed-en.xml` + `public/feed-zh.xml` (Atom feed, latest 20 articles per lang, generated in `prebuild`).

- [ ] **Step 1: Sitemap**

`app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { loadIndex, listDays, listTags } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const index = loadIndex();
  const entries: MetadataRoute.Sitemap = [];
  for (const a of index.articles) {
    entries.push({ url: `/${a.lang}/news/${a.slug}/`, lastModified: a.date, priority: 0.8 });
  }
  for (const lang of ["en", "zh"] as const) {
    for (const d of listDays(lang)) entries.push({ url: `/${lang}/day/${d}/`, lastModified: d, priority: 0.6 });
    for (const t of listTags(lang)) entries.push({ url: `/${lang}/tag/${encodeURIComponent(t)}/`, priority: 0.4 });
    entries.push({ url: `/${lang}/`, priority: 1.0 });
  }
  return entries;
}
```

- [ ] **Step 2: Robots**

`app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/archive/"] },
    sitemap: "https://example.com/sitemap.xml",
  };
}
```

- [ ] **Step 3: RSS feed generator (prebuild script)**

`scripts/generate-feeds.ts`:

```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadIndex } from "@/lib/content";

const SITE = "https://example.com";
const PUBLIC = join(process.cwd(), "public");

function atomFeed(lang: "en" | "zh"): string {
  const index = loadIndex();
  const items = index.articles.filter((a) => a.lang === lang).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 20);
  const updated = items[0]?.date ? new Date(items[0].date).toISOString() : new Date().toISOString();
  const entries = items.map((a) => `    <entry>
      <title>${escape(a.title)}</title>
      <link href="${SITE}/${lang}/news/${a.slug}/"/>
      <updated>${new Date(a.date).toISOString()}</updated>
      <id>${SITE}/${lang}/news/${a.slug}/</id>
    </entry>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Horizon Daily (${lang.toUpperCase()})</title>
  <link href="${SITE}/feed-${lang}.xml" rel="self"/>
  <link href="${SITE}/${lang}/"/>
  <updated>${updated}</updated>
  <id>${SITE}/${lang}/</id>
${entries}
</feed>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, "feed-en.xml"), atomFeed("en"), "utf8");
writeFileSync(join(PUBLIC, "feed-zh.xml"), atomFeed("zh"), "utf8");
console.log("> Wrote public/feed-en.xml, public/feed-zh.xml");
```

- [ ] **Step 4: Feed test**

`tests/feeds.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, cpSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("feed generation", () => {
  it("writes valid atom feeds for en and zh", () => {
    const dir = mkdtempSync(join(tmpdir(), "feeds-"));
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      // copy fixture content into ./content so loadIndex() resolves it
      cpSync(join(__dirname, "fixtures", "content"), join(dir, "content"), { recursive: true });
      cpSync(join(prevCwd, "public"), join(dir, "public"), { recursive: true });
      execSync("pnpm tsx scripts/generate-feeds.ts", { cwd: dir, stdio: "inherit" });
      for (const lang of ["en", "zh"] as const) {
        const f = join(dir, "public", `feed-${lang}.xml`);
        expect(existsSync(f)).toBe(true);
        const xml = readFileSync(f, "utf8");
        expect(xml).toContain("<feed");
        expect(xml).toContain("<entry>");
      }
    } finally {
      process.chdir(prevCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 5: Run tests + build (build triggers prebuild)**

```bash
pnpm test tests/feeds.test.ts && pnpm build
```

Expected: PASS; `out/sitemap.xml`, `out/robots.xml` (Next emits `robots.xml` then it is served as `robots.txt`), `out/feed-en.xml`, `out/feed-zh.xml` present.

> If `next build` emits `robots.xml` instead of `robots.txt`, add a postbuild copy step: in `package.json` add `"postbuild": "node -e \"require('fs').copyFileSync('out/robots.xml','out/robots.txt')\""`. Verify the actual filename in `out/` after the first build and adjust accordingly.

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.ts app/robots.ts scripts/generate-feeds.ts tests/feeds.test.ts
git commit -m "feat(seo): sitemap + robots + atom RSS feeds for en/zh"
```

---

## Phase 8 — Deploy

### Task 19: Dockerfile + nginx config

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `.dockerignore`

**Interfaces:**
- Produces: a multi-stage Docker image: stage 1 installs + builds (`next build` → `out/`), stage 2 copies `out/` into `nginx:alpine` serving on port 80 with gzip + cache headers.

- [ ] **Step 1: nginx config**

`nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json application/xml text/xml image/svg+xml;
    gzip_min_length 1024;

    # Static assets with long cache.
    location ~* \.(?:css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # HTML: short cache, must revalidate.
    location ~* \.html$ {
        expires 5m;
        add_header Cache-Control "public, must-revalidate";
    }

    # Feeds + sitemap.
    location ~* \.xml$ {
        expires 1h;
        add_header Cache-Control "public";
    }

    # SPA-like fallback to index.html is NOT needed (pure static with trailingSlash).
    location / {
        try_files $uri $uri/index.html =404;
    }
}
```

- [ ] **Step 2: Dockerfile**

`Dockerfile`:

```dockerfile
# Stage 1: build the static site.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: serve with nginx.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: .dockerignore**

`.dockerignore`:

```
node_modules
.next
out
content-cache
.git
.gitignore
*.md
docs
tests
```

- [ ] **Step 4: Build the image locally and smoke-test**

```bash
docker build -t horizon-news:local .
docker run --rm -p 8080:80 horizon-news:local
```

Then visit `http://localhost:8080/en/` and `http://localhost:8080/sitemap.xml` to confirm pages and feeds are served.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile nginx.conf .dockerignore
git commit -m "feat(deploy): multi-stage Dockerfile + nginx config"
```

---

### Task 20: CI workflow — worker → build → deploy

**Files:**
- Create: `.github/workflows/daily-build.yml`

**Interfaces:**
- Produces: a GitHub Actions workflow on `schedule` (daily cron) + `workflow_dispatch`, that: runs the worker (`pnpm worker`), commits the regenerated `content/`, builds the Docker image, and pushes it to the registry (GHCR by default). Secrets: `GHCR_TOKEN` (auto via `GITHUB_TOKEN`).

- [ ] **Step 1: Workflow file**

`.github/workflows/daily-build.yml`:

```yaml
name: Daily build

on:
  schedule:
    - cron: "0 6 * * *"  # 06:00 UTC daily
  workflow_dispatch:

permissions:
  contents: write
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Run worker (regenerate content)
        run: pnpm worker

      - name: Typecheck + tests + build
        run: |
          pnpm typecheck
          pnpm test
          pnpm build

      - name: Commit regenerated content
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add content/
          git diff --staged --quiet || git commit -m "chore(content): daily regeneration [skip ci]"
          git push

      - name: Build Docker image
        run: docker build -t ghcr.io/${{ github.repository }}:latest .

      - name: Login to GHCR
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Push image
        run: docker push ghcr.io/${{ github.repository }}:latest
```

- [ ] **Step 2: Verify the workflow file is valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/daily-build.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-build.yml
git commit -m "ci: daily worker→build→deploy workflow with content auto-commit"
```

---

## Verification (final)

After Task 20, run the full verification suite:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
docker build -t horizon-news:local . && docker run --rm -p 8080:80 horizon-news:local
```

Confirm:
- `out/` contains `en/`, `zh/`, `sitemap.xml`, `robots.txt` (or `robots.xml`), `feed-en.xml`, `feed-zh.xml`.
- Article pages contain `application/ld+json` and `<link rel="canonical">`.
- `http://localhost:8080/` redirects to `/en/` or `/zh/`.
- `http://localhost:8080/sitemap.xml` lists article + day + tag URLs.

## Notes for the implementer

- **`params` is a Promise in Next.js 16.** Always `await params` before reading fields. This affects every page in Tasks 13–17.
- **`generateStaticParams` is the only enumeration source.** Never hardcode routes — every URL the site serves must come from the content store so stale links are impossible.
- **The worker is the trust boundary for `fullText.html`.** It is sanitized with DOMPurify (Task 9); the site renders it via `dangerouslySetInnerHTML` (Task 15). Markdown fields get an additional `rehype-sanitize` pass on render.
- **Tests must never hit the network.** Fetcher tests use a local `http` server (Task 8) and fixture HTML (Task 9); orchestration tests stub `cloneHorizonPosts` (Task 11); site tests use the committed `tests/fixtures/content/` store (Task 12).
- **Commit after every task.** Conventional Commits, scoped (`feat(worker):`, `feat(site):`, `feat(seo):`, `test:`, `chore:`, `ci:`).

