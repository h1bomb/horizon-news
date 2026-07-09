import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { DaySummary } from "@/components/DaySummary";
import { loadDay, loadArticle, listDays } from "@/lib/content";
import { buildDayMetadata, itemListJsonLd } from "@/lib/seo";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  const langs: Lang[] = ["en", "zh"];
  return langs.flatMap((lang) => listDays(lang).map((date) => ({ lang, date })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; date: string }> }) {
  const { lang, date } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  if (!listDays(langOk).includes(date)) return {};
  return buildDayMetadata(loadDay(langOk, date), langOk);
}

export default async function DayPage({ params }: { params: Promise<{ lang: string; date: string }> }) {
  const { lang, date } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  if (!listDays(langOk).includes(date)) notFound();
  const day = loadDay(langOk, date);
  const articles = day.articleIds.map((id) => loadArticle(langOk, id)).sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{date}</h1>
      <DaySummary text={day.daySummary} />
      <div className="space-y-4">
        {articles.map((a) => <ArticleCard key={a.id} article={a} lang={langOk} />)}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(day, langOk)) }} />
    </div>
  );
}
