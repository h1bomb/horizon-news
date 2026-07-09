import matter from "gray-matter";
import { LangSchema, type Lang } from "@/shared/schema";

export interface FrontmatterResult {
  body: string;
  lang: Lang;
  date: string;
}

export function stripFrontmatter(
  md: string,
  fallbackLang: Lang = "en",
  fallbackDate = "1970-01-01",
): FrontmatterResult {
  const parsed = matter(md);
  const fm = parsed.data as Record<string, unknown>;
  const langParsed = LangSchema.safeParse(fm.lang ?? fallbackLang);
  const lang = langParsed.success ? langParsed.data : fallbackLang;
  const rawDate = fm.date;
  const date =
    typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : rawDate instanceof Date && !Number.isNaN(rawDate.getTime())
        ? rawDate.toISOString().slice(0, 10)
        : fallbackDate;
  const body = parsed.content !== md ? parsed.content.trim() : md;
  return { body, lang, date };
}
