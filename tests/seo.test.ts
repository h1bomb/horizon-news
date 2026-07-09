import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadIndexFrom, loadArticleFrom } from "@/lib/content";
import { buildArticleMetadata, newsArticleJsonLd } from "@/lib/seo";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("seo builders", () => {
  it("builds article metadata with canonical + description", () => {
    const index = loadIndexFrom(FIXTURE);
    const article = loadArticleFrom(FIXTURE, "en", index.articles[0].id);
    const md = buildArticleMetadata(article);
    expect(md.title).toBe(article.title);
    expect(md.alternates?.canonical).toBe(`/en/news/${article.slug}/`);
    const og = md.openGraph;
    expect(og && "type" in og ? og.type : undefined).toBe("article");
  });

  it("builds NewsArticle JSON-LD with required fields", () => {
    const index = loadIndexFrom(FIXTURE);
    const article = loadArticleFrom(FIXTURE, "en", index.articles[0].id);
    const ld = newsArticleJsonLd(article);
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.headline).toBe(article.title);
    expect(ld.datePublished).toBe(article.publishedAt);
    expect(ld.mainEntityOfPage).toContain("/en/news/");
  });
});
