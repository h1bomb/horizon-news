import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { loadIndex, loadArticle, listTags } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  const index = loadIndex();
  const langs: Lang[] = ["en", "zh"];
  const params: { lang: Lang; tag: string }[] = [];
  for (const lang of langs) {
    for (const a of index.articles) if (a.lang === lang) for (const t of a.tags) params.push({ lang, tag: t });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; tag: string }> }) {
  const { lang, tag } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const decoded = decodeURIComponent(tag);
  const title = `#${decoded}`;
  const description = langOk === "zh" ? `标签 ${decoded} 的所有文章` : `All articles tagged ${decoded}`;
  return { title, description, alternates: { canonical: `/${langOk}/tag/${encodeURIComponent(decoded)}/` } };
}

export default async function TagPage({ params }: { params: Promise<{ lang: string; tag: string }> }) {
  const { lang, tag } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const decoded = decodeURIComponent(tag);
  if (!listTags(langOk).includes(decoded)) notFound();
  const index = loadIndex();
  const matches = index.articles.filter((a) => a.lang === langOk && a.tags.includes(decoded));
  const articles = matches.map((m) => loadArticle(langOk, m.id)).sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">#{decoded}</h1>
      <div className="space-y-4">
        {articles.map((a) => <ArticleCard key={a.id} article={a} lang={langOk} />)}
      </div>
    </div>
  );
}
