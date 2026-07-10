import Link from "next/link";
import { listDays, loadDay } from "@/lib/content";
import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const title = langOk === "zh" ? "归档" : "Archive";
  const description = langOk === "zh" ? "所有每日简报的 chronological 归档" : "Chronological archive of all daily briefings";
  return { title, description, alternates: { canonical: `/${langOk}/archive/` } };
}

export default async function ArchivePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const days = listDays(langOk).sort();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{langOk === "zh" ? "归档" : "Archive"}</h1>
      <ul className="space-y-2">
        {days.map((d) => {
          const day = loadDay(langOk, d);
          return (
            <li key={d} className="flex items-baseline gap-3">
              <Link href={`/${langOk}/day/${d}/`} className="font-medium hover:underline">{d}</Link>
              <span className="text-sm text-muted-foreground">{day.articleIds.length} {langOk === "zh" ? "条" : "stories"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
