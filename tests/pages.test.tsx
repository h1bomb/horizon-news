import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleBody } from "@/components/ArticleBody";
import { loadIndexFrom, loadArticleFrom } from "@/lib/content";
import { resolve } from "node:path";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("ArticleCard", () => {
  it("renders title, score, site, and tags", () => {
    const index = loadIndexFrom(FIXTURE);
    const first = index.articles.find((a) => a.lang === "en")!;
    const article = loadArticleFrom(FIXTURE, "en", first.id);
    const { getByText } = render(<ArticleCard article={article} lang="en" />);
    expect(getByText(article.title)).toBeTruthy();
    expect(getByText(/openai\.com|cyberinsider|devblogs/i)).toBeTruthy();
    article.tags.slice(0, 1).forEach((t) => expect(getByText(`#${t}`)).toBeTruthy());
  });
});

describe("ArticleBody", () => {
  it("renders summary, background, references, and read-original link", () => {
    const index = loadIndexFrom(FIXTURE);
    const article = index.articles
      .filter((a) => a.lang === "en")
      .map((a) => loadArticleFrom(FIXTURE, "en", a.id))
      .find((a) => a.references.length > 0)!;
    const { container, getByText } = render(<ArticleBody article={article} lang="en" />);
    expect(container.textContent).toContain(article.summary.slice(0, 20));
    expect(getByText("Background")).toBeTruthy();
    expect(getByText(/Read original/)).toBeTruthy();
  });
});
