import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import { DaySummary } from "@/components/DaySummary";
import { EmptyState } from "@/components/EmptyState";
import { loadIndex, loadDay, listDays, loadArticle } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const index = loadIndex();
  const items = index.articles.filter((a) => a.lang === langOk);
  const days = listDays(langOk);
  const today = days[0];
  const todayDay = today ? loadDay(langOk, today) : null;
  const todayArticles = items.filter((a) => a.date === today).sort((a, b) => b.score - a.score);
  const recentDays = days.slice(1, 6);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-2 text-2xl font-bold">{langOk === "zh" ? "今日要闻" : "Today's Top Stories"}</h1>
        {todayDay && <DaySummary text={todayDay.daySummary} />}
        {todayArticles.length === 0 ? (
          <EmptyState lang={langOk} />
        ) : (
          <div className="space-y-4">
            {todayArticles.map((a) => <ArticleCard key={a.id} article={loadArticle(langOk, a.id)} lang={langOk} />)}
          </div>
        )}
      </section>
      {recentDays.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-semibold">{langOk === "zh" ? "近期" : "Recent"}</h2>
          <ul className="flex flex-wrap gap-2">
            {recentDays.map((d) => (
              <li key={d}><Link href={`/${langOk}/day/${d}/`} className="text-sm text-primary hover:underline">{d}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
