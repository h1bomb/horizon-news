import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ArticleSchema, IndexSchema, MetaSchema, DaySchema, type Article, type Index, type Meta, type Day } from "@/shared/schema";
import type { ParsedBriefing, ParsedItem } from "@/worker/parser/parse";

export interface Enrichment {
  fullText: Article["fullText"];
  image: string | null;
}

export interface WriteMeta {
  horizonCommit: string;
  workerVersion: string;
}

export async function writeContentStore(
  rootDir: string,
  briefings: ParsedBriefing[],
  enrichments: Map<string, Enrichment>,
  meta: WriteMeta,
): Promise<void> {
  const slugCounts = new Map<string, number>(); // lang|slugBase -> count
  const articles: Article[] = [];
  const days: Day[] = [];

  for (const sub of ["articles", "days"]) {
    const dir = join(rootDir, sub);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }

  for (const b of briefings) {
    const articleIds: string[] = [];
    for (const it of b.items) {
      const slug = uniqueSlug(it, b.lang, slugCounts);
      const enrich = enrichments.get(it.id) ?? { fullText: null, image: null };
      const article: Article = {
        id: it.id,
        canonicalId: it.canonicalId,
        slug,
        date: it.date,
        publishedAt: it.publishedAt,
        lang: it.lang,
        title: it.title,
        summary: it.summary,
        score: it.score,
        tags: it.tags,
        sources: it.sources,
        originalUrl: it.originalUrl,
        originalSite: it.originalSite,
        context: it.context,
        discussion: it.discussion,
        references: it.references,
        image: enrich.image,
        fullText: enrich.fullText,
      };
      const parsed = ArticleSchema.safeParse(article);
      if (!parsed.success) {
        throw new Error(`Invalid article ${it.id}: ${parsed.error.message}`);
      }
      writeArticle(rootDir, parsed.data);
      articles.push(parsed.data);
      articleIds.push(parsed.data.id);
    }
    const day: Day = { date: b.date, lang: b.lang, daySummary: b.daySummary, articleIds };
    const dayParsed = DaySchema.safeParse(day);
    if (!dayParsed.success) throw new Error(`Invalid day ${b.date}/${b.lang}: ${dayParsed.error.message}`);
    writeDay(rootDir, dayParsed.data);
    days.push(dayParsed.data);
  }

  const index: Index = { articles: articles.map((a) => ({
    id: a.id, canonicalId: a.canonicalId, slug: a.slug, date: a.date, lang: a.lang,
    title: a.title, score: a.score, tags: a.tags, originalSite: a.originalSite,
  })) };
  const indexParsed = IndexSchema.safeParse(index);
  if (!indexParsed.success) throw new Error(`Invalid index: ${indexParsed.error.message}`);
  writeFileSync(join(rootDir, "index.json"), JSON.stringify(indexParsed.data, null, 2), "utf8");

  const metaObj: Meta = {
    lastBuiltAt: new Date().toISOString(),
    horizonCommit: meta.horizonCommit,
    counts: {
      articles: articles.length,
      days: days.length,
      byLang: {
        en: articles.filter((a) => a.lang === "en").length,
        zh: articles.filter((a) => a.lang === "zh").length,
      },
    },
    workerVersion: meta.workerVersion,
  };
  const metaParsed = MetaSchema.safeParse(metaObj);
  if (!metaParsed.success) throw new Error(`Invalid meta: ${metaParsed.error.message}`);
  writeFileSync(join(rootDir, "meta.json"), JSON.stringify(metaParsed.data, null, 2), "utf8");
}

function uniqueSlug(it: ParsedItem, lang: string, counts: Map<string, number>): string {
  const key = `${lang}|${it.slugBase}`;
  const n = counts.get(key) ?? 0;
  counts.set(key, n + 1);
  if (n === 0) return it.slugBase;
  return `${it.slugBase}-${it.id.slice(0, 8)}`;
}

function writeArticle(rootDir: string, a: Article): void {
  const dir = join(rootDir, "articles", a.lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${a.id}.json`), JSON.stringify(a, null, 2), "utf8");
}

function writeDay(rootDir: string, d: Day): void {
  const dir = join(rootDir, "days", d.lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${d.date}.json`), JSON.stringify(d, null, 2), "utf8");
}
