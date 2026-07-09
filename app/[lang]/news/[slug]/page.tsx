import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
import { TagList } from "@/components/TagList";
import { loadIndex, loadArticle } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  const index = loadIndex();
  return index.articles.map((a) => ({ lang: a.lang, slug: a.slug }));
}

export default async function ArticlePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const index = loadIndex();
  const entry = index.articles.find((a) => a.lang === langOk && a.slug === slug);
  if (!entry) notFound();
  const article = loadArticle(langOk, entry.id);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <p className="text-sm text-muted-foreground">
          {article.originalSite} · ⭐️ {article.score}/10 · {article.publishedAt.slice(0, 10)}
        </p>
        <TagList tags={article.tags} lang={langOk} />
      </header>
      <ArticleBody article={article} lang={langOk} />
    </div>
  );
}
