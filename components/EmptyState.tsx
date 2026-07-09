import type { Lang } from "@/shared/schema";

export function EmptyState({ lang }: { lang: Lang }) {
  const t = lang === "zh" ? "今日暂无重要动态。" : "No significant developments today.";
  return <p className="py-12 text-center text-muted-foreground">{t}</p>;
}
