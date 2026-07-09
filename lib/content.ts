import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { IndexSchema, MetaSchema, ArticleSchema, DaySchema, type Index, type Meta, type Article, type Day, type Lang } from "@/shared/schema";

export const CONTENT_DIR = join(process.cwd(), "content");

export function loadIndex(): Index { return loadIndexFrom(CONTENT_DIR); }
export function loadMeta(): Meta { return loadMetaFrom(CONTENT_DIR); }
export function loadArticle(lang: Lang, id: string): Article { return loadArticleFrom(CONTENT_DIR, lang, id); }
export function loadDay(lang: Lang, date: string): Day { return loadDayFrom(CONTENT_DIR, lang, date); }
export function listDays(lang: Lang): string[] { return listDaysFrom(CONTENT_DIR, lang); }
export function listTags(lang: Lang): string[] { return listTagsFrom(CONTENT_DIR, lang); }
export function findArticleBySlug(lang: Lang, slug: string): Article | null { return findArticleBySlugFrom(CONTENT_DIR, lang, slug); }

export function loadIndexFrom(root: string): Index {
  return IndexSchema.parse(JSON.parse(readFileSync(join(root, "index.json"), "utf8")));
}
export function loadMetaFrom(root: string): Meta {
  return MetaSchema.parse(JSON.parse(readFileSync(join(root, "meta.json"), "utf8")));
}
export function loadArticleFrom(root: string, lang: Lang, id: string): Article {
  return ArticleSchema.parse(JSON.parse(readFileSync(join(root, "articles", lang, `${id}.json`), "utf8")));
}
export function loadDayFrom(root: string, lang: Lang, date: string): Day {
  return DaySchema.parse(JSON.parse(readFileSync(join(root, "days", lang, `${date}.json`), "utf8")));
}
export function listDaysFrom(root: string, lang: Lang): string[] {
  const dir = join(root, "days", lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}
export function listTagsFrom(root: string, lang: Lang): string[] {
  const index = loadIndexFrom(root);
  const set = new Set<string>();
  for (const a of index.articles) if (a.lang === lang) for (const t of a.tags) set.add(t);
  return [...set].sort();
}
export function findArticleBySlugFrom(root: string, lang: Lang, slug: string): Article | null {
  const index = loadIndexFrom(root);
  const hit = index.articles.find((a) => a.lang === lang && a.slug === slug);
  return hit ? loadArticleFrom(root, lang, hit.id) : null;
}
