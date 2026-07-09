import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadIndex } from "@/lib/content";

const SITE = "https://example.com";
const PUBLIC = join(process.cwd(), "public");

function atomFeed(lang: "en" | "zh"): string {
  const index = loadIndex();
  const items = index.articles.filter((a) => a.lang === lang).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 20);
  const updated = items[0]?.date ? new Date(items[0].date).toISOString() : new Date().toISOString();
  const entries = items.map((a) => `    <entry>
      <title>${escape(a.title)}</title>
      <link href="${SITE}/${lang}/news/${a.slug}/"/>
      <updated>${new Date(a.date).toISOString()}</updated>
      <id>${SITE}/${lang}/news/${a.slug}/</id>
    </entry>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Horizon Daily (${lang.toUpperCase()})</title>
  <link href="${SITE}/feed-${lang}.xml" rel="self"/>
  <link href="${SITE}/${lang}/"/>
  <updated>${updated}</updated>
  <id>${SITE}/${lang}/</id>
${entries}
</feed>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, "feed-en.xml"), atomFeed("en"), "utf8");
writeFileSync(join(PUBLIC, "feed-zh.xml"), atomFeed("zh"), "utf8");
console.log("> Wrote public/feed-en.xml, public/feed-zh.xml");
