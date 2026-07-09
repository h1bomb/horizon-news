import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
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
