import type { Reference } from "@/shared/schema";

const DETAILS_RE = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)\s*<\/details>/i;
const LI_RE = /<li>\s*([\s\S]*?)\s*<\/li>/gi;
const A_RE = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i;

export function parseReferences(html: string): Reference[] {
  const block = html.match(DETAILS_RE);
  if (!block) return [];
  const listHtml = block[2];
  const refs: Reference[] = [];
  for (const li of listHtml.matchAll(LI_RE)) {
    const item = li[1];
    const a = item.match(A_RE);
    if (a) {
      const url = a[1].trim();
      const title = stripTags(a[2]).trim();
      if (title && url) refs.push({ title, url });
    }
  }
  return refs;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}
