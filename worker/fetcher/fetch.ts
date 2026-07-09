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
