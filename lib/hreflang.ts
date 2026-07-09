import { loadIndex, loadArticle } from "@/lib/content";
import type { Article, Lang } from "@/shared/schema";

export function findTranslation(article: Article): Article | null {
  const otherLang: Lang = article.lang === "en" ? "zh" : "en";
  const index = loadIndex();
  const match = index.articles.find((a) => a.lang === otherLang && a.canonicalId === article.canonicalId);
  return match ? loadArticle(otherLang, match.id) : null;
}
