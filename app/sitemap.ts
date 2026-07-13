import type { MetadataRoute } from "next";
import { loadIndex, listDays, listTags } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const index = loadIndex();
  const entries: MetadataRoute.Sitemap = [];
  for (const a of index.articles) {
    entries.push({ url: `${SITE_URL}/${a.lang}/news/${a.slug}/`, lastModified: a.date, priority: 0.8 });
  }
  for (const lang of ["en", "zh"] as const) {
    for (const d of listDays(lang)) entries.push({ url: `${SITE_URL}/${lang}/day/${d}/`, lastModified: d, priority: 0.6 });
    for (const t of listTags(lang)) entries.push({ url: `${SITE_URL}/${lang}/tag/${encodeURIComponent(t)}/`, priority: 0.4 });
    entries.push({ url: `${SITE_URL}/${lang}/`, priority: 1.0 });
  }
  return entries;
}
