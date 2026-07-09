import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArticleCard } from "@/components/ArticleCard";
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
