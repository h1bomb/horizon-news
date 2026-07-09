import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripFrontmatter } from "@/worker/parser/frontmatter";
import { parseBriefing } from "@/worker/parser/parse";

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

describe("parseBriefing", () => {
  it("parses the EN fixture into 3 items with all fields", () => {
    const { date, lang, daySummary, items } = parseBriefing(fixture("2026-07-08-summary-en.md"));
    expect(date).toBe("2026-07-08");
    expect(lang).toBe("en");
    expect(daySummary).toBe("From 40 items, 16 important content pieces were selected");
    expect(items.length).toBe(3);

    const first = items[0];
    expect(first.title).toBe("EU close to reviving message scanning rules");
    expect(first.originalUrl).toBe("https://cyberinsider.com/eu-now-one-step-away-from-reviving-private-message-scanning-rules/");
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
    const { lang, daySummary, items } = parseBriefing(fixture("2026-07-08-summary-zh.md"));
    expect(lang).toBe("zh");
    expect(daySummary).toBe("从 40 条内容中筛选出 16 条重要资讯。");
    expect(items.length).toBe(2);
    expect(items[0].title).toBe("欧盟即将重启消息扫描规则");
    expect(items[0].context).toContain("聊天控制");
    expect(items[0].references[0].url).toBe("https://en.wikipedia.org/wiki/Chat_Control");
  });

  it("detects the empty-day briefing and returns no items", () => {
    const { daySummary, items } = parseBriefing(fixture("empty-en.md"));
    expect(items).toEqual([]);
    expect(daySummary).toBe("Analyzed 25 items, but none met the importance threshold.");
  });
});
