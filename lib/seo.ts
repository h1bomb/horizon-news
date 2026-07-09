import type { Metadata } from "next";
import type { Article, Day, Lang } from "@/shared/schema";
import { findTranslation } from "@/lib/hreflang";

const SITE = "https://example.com";

export function buildArticleMetadata(article: Article): Metadata {
  const description = article.fullText?.excerpt || stripMd(article.summary).slice(0, 160);
  const alternates: Record<string, string> = {};
  const tr = findTranslation(article);
  if (tr) alternates[tr.lang] = `/${tr.lang}/news/${tr.slug}/`;
  alternates[article.lang] = `/${article.lang}/news/${article.slug}/`;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/${article.lang}/news/${article.slug}/`, languages: alternates },
    openGraph: {
      title: article.title,
      description,
      url: `${SITE}/${article.lang}/news/${article.slug}/`,
      type: "article",
      images: article.image ? [{ url: article.image }] : undefined,
      publishedTime: article.publishedAt,
    },
    twitter: { card: "summary_large_image", title: article.title, description },
  };
}

export function buildDayMetadata(day: Day, lang: Lang): Metadata {
  return {
    title: lang === "zh" ? `${day.date} 日报` : `${day.date} Daily`,
    description: day.daySummary,
    alternates: { canonical: `/${lang}/day/${day.date}/` },
  };
}

export function newsArticleJsonLd(article: Article) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt,
    author: article.sources[0]?.author ? { "@type": "Person", name: article.sources[0].author } : undefined,
    image: article.image ? [article.image] : undefined,
    publisher: { "@type": "Organization", name: "Horizon Daily" },
    mainEntityOfPage: `${SITE}/${article.lang}/news/${article.slug}/`,
  };
}

export function itemListJsonLd(day: Day, lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: lang === "zh" ? `${day.date} 日报` : `${day.date} Daily`,
    itemListElement: day.articleIds.map((id, i) => ({
      "@type": "ListItem", position: i + 1, url: `${SITE}/${lang}/news/?id=${id}`,
    })),
  };
}

function stripMd(s: string): string {
  return s.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
}
