import type { Lang } from "@/shared/schema";

export interface ParsedSourceLine {
  platform: string;
  author?: string;
  publishedAt: string | null; // ISO 8601 UTC, or null
  discussionUrl?: string;
}

const MONTHS_EN: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export function parseSourceLine(line: string, lang: Lang, year: number): ParsedSourceLine {
  const discussion = lang === "zh" ? /\[社区讨论\]\(([^)]+)\)/ : /\[Discussion\]\(([^)]+)\)/;
  const discMatch = line.match(discussion);
  const discussionUrl = discMatch?.[1];

  const withoutDisc = line.replace(discussion, "").trim().replace(/\s*·\s*$/, "");

  const parts = withoutDisc.split("·").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { platform: "unknown", publishedAt: null };

  const platform = parts[0];
  let author: string | undefined;
  let dateStr: string | null = null;

  if (lang === "zh") {
    const zhDate = parts.find((p) => /\d+月\d+日\s+\d{1,2}:\d{2}/.test(p));
    if (zhDate) {
      dateStr = zhDate;
      const middle = parts.slice(1, parts.indexOf(zhDate));
      author = middle[middle.length - 1] || undefined;
    } else {
      const middle = parts.slice(1);
      author = middle[middle.length - 1] || undefined;
    }
  } else {
    const enDate = parts.find((p) => /^[A-Z][a-z]{2}\s+\d{1,2},\s*\d{1,2}:\d{2}$/.test(p));
    if (enDate) {
      dateStr = enDate;
      const middle = parts.slice(1, parts.indexOf(enDate));
      author = middle[middle.length - 1] || undefined;
    } else {
      const middle = parts.slice(1);
      author = middle[middle.length - 1] || undefined;
    }
  }

  const publishedAt = dateStr ? toIso(dateStr, lang, year) : null;
  return { platform, author: author || undefined, publishedAt, discussionUrl };
}

function toIso(dateStr: string, lang: Lang, year: number): string | null {
  if (lang === "zh") {
    const m = dateStr.match(/(\d+)月(\d+)日\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const [, mo, d, h, mi] = m;
    return `${year}-${pad(+mo)}-${pad(+d)}T${pad(+h)}:${mi}:00Z`;
  }
  const m = dateStr.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, mon, d, h, mi] = m;
  const mo = MONTHS_EN[mon];
  if (!mo) return null;
  return `${year}-${pad(mo)}-${pad(+d)}T${pad(+h)}:${mi}:00Z`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
