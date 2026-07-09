import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TagList } from "@/components/TagList";
import type { Article, Lang } from "@/shared/schema";

export function ArticleCard({ article, lang }: { article: Article; lang: Lang }) {
  const href = `/${lang}/news/${article.slug}/`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href={href} className="text-lg font-semibold hover:underline">{article.title}</Link>
          <p className="text-sm text-muted-foreground">
            {article.originalSite} · ⭐️ {article.score}/10 · {article.date}
          </p>
        </div>
        <Badge variant="secondary">{article.score}/10</Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-sm">{stripMd(article.summary)}</p>
      <TagList tags={article.tags} lang={lang} />
    </Card>
  );
}

function stripMd(s: string): string {
  return s.replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
}
