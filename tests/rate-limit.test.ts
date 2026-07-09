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
