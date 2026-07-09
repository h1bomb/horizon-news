import type { Lang } from "@/shared/schema";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "zh" }];
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const langOk = (lang === "en" || lang === "zh" ? lang : "en") as Lang;
  const content = langOk === "zh"
    ? { title: "关于", body: "本站由 Horizon 每日 AI 新闻雷达驱动，自动聚合 Hacker News、Reddit、Telegram、RSS 等来源的重要资讯，提供中英双语版本。所有页面为静态生成，适合自托管。" }
    : { title: "About", body: "This site is powered by Horizon, a daily AI news radar that aggregates important stories from Hacker News, Reddit, Telegram, RSS, and more, in English and Chinese. All pages are statically generated and self-hostable." };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{content.title}</h1>
      <p className="text-sm leading-relaxed">{content.body}</p>
    </div>
  );
}
