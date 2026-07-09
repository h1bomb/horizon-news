import { z } from "zod";

export const LangSchema = z.enum(["en", "zh"]);
export type Lang = z.infer<typeof LangSchema>;

export const SourceRefSchema = z.object({
  platform: z.string().min(1),
  author: z.string().optional(),
  discussionUrl: z.string().url().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ReferenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const FullTextSchema = z.object({
  html: z.string(),
  byline: z.string().nullable(),
  excerpt: z.string(),
  wordCount: z.number().int().nonnegative(),
  fetchedAt: z.string(),
  status: z.enum(["ok", "fallback", "failed"]),
});
export type FullText = z.infer<typeof FullTextSchema>;

export const HexId = z.string().regex(/^[0-9a-f]{40}$/);

export const ArticleSchema = z.object({
  id: HexId,
  canonicalId: HexId,
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publishedAt: z.string(),
  lang: LangSchema,
  title: z.string().min(1),
  summary: z.string(),
  score: z.number().min(0).max(10),
  tags: z.array(z.string()),
  sources: z.array(SourceRefSchema),
  originalUrl: z.string().url(),
  originalSite: z.string().min(1),
  context: z.string(),
  discussion: z.string(),
  references: z.array(ReferenceSchema),
  image: z.string().url().nullable(),
  fullText: FullTextSchema.nullable(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: LangSchema,
  daySummary: z.string(),
  articleIds: z.array(HexId),
});
export type Day = z.infer<typeof DaySchema>;

export const IndexArticleSchema = z.object({
  id: HexId,
  canonicalId: HexId,
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: LangSchema,
  title: z.string().min(1),
  score: z.number().min(0).max(10),
  tags: z.array(z.string()),
  originalSite: z.string().min(1),
});
export type IndexArticle = z.infer<typeof IndexArticleSchema>;

export const IndexSchema = z.object({
  articles: z.array(IndexArticleSchema),
});
export type Index = z.infer<typeof IndexSchema>;

export const MetaSchema = z.object({
  lastBuiltAt: z.string(),
  horizonCommit: z.string(),
  counts: z.object({
    articles: z.number().int().nonnegative(),
    days: z.number().int().nonnegative(),
    byLang: z.object({ en: z.number().int().nonnegative(), zh: z.number().int().nonnegative() }),
  }),
  workerVersion: z.string(),
});
export type Meta = z.infer<typeof MetaSchema>;
