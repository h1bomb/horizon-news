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
