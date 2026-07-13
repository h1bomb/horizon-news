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
  const args: CliArgs = { horizonRef: "gh-pages", noFetch: false };
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

  const files = readdirSync(postsDir).filter((f) => /-summary-(en|zh)\.md$/.test(f)).sort().reverse();
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
