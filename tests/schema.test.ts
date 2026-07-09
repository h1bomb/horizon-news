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
