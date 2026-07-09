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
