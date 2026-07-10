import type { MetadataRoute } from "next";
import { loadIndex, listDays, listTags } from "@/lib/content";

export const dynamic = "force-static";

const SITE = "https://example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const index = loadIndex();
  const entries: MetadataRoute.Sitemap = [];
  for (const a of index.articles) {
    entries.push({ url: `${SITE}/${a.lang}/news/${a.slug}/`, lastModified: a.date, priority: 0.8 });
  }
  for (const lang of ["en", "zh"] as const) {
    for (const d of listDays(lang)) entries.push({ url: `${SITE}/${lang}/day/${d}/`, lastModified: d, priority: 0.6 });
    for (const t of listTags(lang)) entries.push({ url: `${SITE}/${lang}/tag/${encodeURIComponent(t)}/`, priority: 0.4 });
    entries.push({ url: `${SITE}/${lang}/`, priority: 1.0 });
  }
  return entries;
}
