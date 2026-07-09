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
