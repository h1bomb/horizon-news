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
    const url = `http://localhost:${port}/blocked`;
    const r = await fetchWithCache(url, { cacheDir, rateLimiter: new RateLimiter(1), robotsChecker: { allowed: () => false, crawlDelay: () => undefined } });
    expect(r.status).toBe(0);
    expect(r.html).toBe("");
  });
});
