import { extractFromHtml } from "@extractus/article-extractor";
import DOMPurify from "isomorphic-dompurify";
import type { FullText } from "@/shared/schema";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "b", "strong", "i", "em", "blockquote", "code", "pre", "br", "hr", "img", "figure", "figcaption", "span", "div"],
  ALLOWED_ATTR: ["href", "title", "alt", "src", "srcset"],
};

export async function extractArticle(html: string, url: string): Promise<FullText> {
  const fetchedAt = new Date().toISOString();
  if (!html || html.trim().length < 50) {
    return { html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt, status: "fallback" };
  }
  try {
    const article = await extractFromHtml(html, url);
    if (!article || !article.content) {
      return { html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt, status: "fallback" };
    }
    const clean = DOMPurify.sanitize(article.content, SANITIZE_CONFIG);
    const text = clean.replace(/<[^>]+>/g, " ");
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const excerpt = (article.description || text.slice(0, 160)).trim();
    return {
      html: clean,
      byline: article.author || null,
      excerpt,
      wordCount,
      fetchedAt,
      status: "ok",
    };
  } catch {
    return { html: "", byline: null, excerpt: "", wordCount: 0, fetchedAt, status: "fallback" };
  }
}
