import { Markdown } from "@/components/Markdown";
import { FullText } from "@/components/FullText";
import type { Article, Lang } from "@/shared/schema";

export function ArticleBody({ article, lang }: { article: Article; lang: Lang }) {
  const labels = lang === "zh"
    ? { background: "背景", discussion: "社区讨论", references: "参考链接", read: "阅读原文" }
    : { background: "Background", discussion: "Discussion", references: "References", read: "Read original" };
  return (
    <article className="space-y-6">
      <Markdown>{article.summary}</Markdown>
      {article.context && (
        <section><h2 className="text-lg font-semibold">{labels.background}</h2><Markdown>{article.context}</Markdown></section>
      )}
      {article.references.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{labels.references}</h2>
          <ul className="list-disc space-y-1 pl-6">
            {article.references.map((r) => <li key={r.url}><a href={r.url} className="text-primary hover:underline">{r.title}</a></li>)}
          </ul>
        </section>
      )}
      {article.discussion && (
        <section><h2 className="text-lg font-semibold">{labels.discussion}</h2><Markdown>{article.discussion}</Markdown></section>
      )}
      {article.fullText && <FullText html={article.fullText.html} />}
      <p><a href={article.originalUrl} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">→ {labels.read}</a></p>
    </article>
  );
}
