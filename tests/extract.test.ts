import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractArticle } from "@/worker/fetcher/extract";

const html = readFileSync(resolve(__dirname, "fixtures", "sample-article.html"), "utf8");

describe("extractArticle", () => {
  it("extracts main content and strips scripts", async () => {
    const ft = await extractArticle(html, "https://example.com/sample");
    expect(ft.status).toBe("ok");
    expect(ft.html).toContain("first paragraph");
    expect(ft.html).not.toContain("evil");
    expect(ft.html).not.toContain("<script");
    expect(ft.wordCount).toBeGreaterThan(5);
    expect(ft.excerpt.length).toBeGreaterThan(0);
    expect(ft.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns fallback on empty html", async () => {
    const ft = await extractArticle("", "https://example.com/empty");
    expect(ft.status).toBe("fallback");
    expect(ft.html).toBe("");
    expect(ft.wordCount).toBe(0);
  });

  it("returns fallback on unparseable html", async () => {
    const ft = await extractArticle("<div><p>no article", "https://example.com/bad");
    expect(["fallback", "ok"]).toContain(ft.status);
  });
});
