import { stripFrontmatter } from "@/worker/parser/frontmatter";
import { parseSourceLine } from "@/worker/parser/source-line";
import { parseReferences } from "@/worker/parser/references";
import { makeId, makeCanonicalId } from "@/shared/ids";
import { slugify } from "@/shared/slug";
import type { Lang, Reference, SourceRef } from "@/shared/schema";

export interface ParsedItem {
  id: string;
  canonicalId: string;
  slugBase: string;
  date: string;
  publishedAt: string;
  lang: Lang;
  title: string;
  summary: string;
  score: number;
  tags: string[];
  sources: SourceRef[];
  originalUrl: string;
  originalSite: string;
  context: string;
  discussion: string;
  references: Reference[];
}

export interface ParsedBriefing {
  date: string;
  lang: Lang;
  daySummary: string;
  items: ParsedItem[];
}

const ITEM_ANCHOR_RE = /^<a id="item-(\d+)"><\/a>\s*$/;
const HEADING_RE = /^##\s+\[(.+?)\]\((https?:\/\/[^)]+)\)\s+⭐️\s+([\d.]+)\/10\s*$/m;
const BG_RE_EN = /\*\*Background\*\*:\s*([\s\S]*?)(?=\n\*\*[^*]+\*\*:|(?![\s\S]))/;
const BG_RE_ZH = /\*\*背景\*\*:\s*([\s\S]*?)(?=\n\*\*[^*]+\*\*:|(?![\s\S]))/;
const DISC_RE_EN = /\*\*Discussion\*\*:\s*([\s\S]*?)(?=\n\*\*[^*]+\*\*:|(?![\s\S]))/;
const DISC_RE_ZH = /\*\*社区讨论\*\*:\s*([\s\S]*?)(?=\n\*\*[^*]+\*\*:|(?![\s\S]))/;
const TAGS_RE_EN = /^\*\*Tags\*\*:\s*(.*)$/m;
const TAGS_RE_ZH = /^\*\*标签\*\*:\s*(.*)$/m;
const DETAILS_RE = /<details>[\s\S]*?<\/details>/i;
const EMPTY_RE_EN = /Analyzed (\d+) items, but none met the importance threshold/;
const EMPTY_RE_ZH = /已分析 (\d+) 条内容，但没有达到重要性阈值的条目/;

export function parseBriefing(
  md: string,
  fallbackLang: Lang = "en",
  fallbackDate = "1970-01-01",
): ParsedBriefing {
  const { body, lang, date } = stripFrontmatter(md, fallbackLang, fallbackDate);
  const year = parseInt(date.slice(0, 4), 10);

  // Day summary = the leading "> ..." quote line.
  const summaryMatch = body.match(/^>\s*(.+)$/m);
  const daySummary = summaryMatch ? summaryMatch[1].trim() : "";

  const emptyRe = lang === "zh" ? EMPTY_RE_ZH : EMPTY_RE_EN;
  if (emptyRe.test(body)) {
    return { date, lang, daySummary, items: [] };
  }

  const items = parseItems(body, lang, date, year);
  return { date, lang, daySummary, items };
}

function parseItems(body: string, lang: Lang, date: string, year: number): ParsedItem[] {
  const lines = body.split("\n");
  const items: ParsedItem[] = [];
  let i = 0;
  const bgRe = lang === "zh" ? BG_RE_ZH : BG_RE_EN;
  const discRe = lang === "zh" ? DISC_RE_ZH : DISC_RE_EN;
  const tagsRe = lang === "zh" ? TAGS_RE_ZH : TAGS_RE_EN;

  while (i < lines.length) {
    const line = lines[i];
    if (ITEM_ANCHOR_RE.test(line)) {
      const blockEnd = findBlockEnd(lines, i + 1);
      const block = lines.slice(i + 1, blockEnd);
      items.push(buildItem(block, lang, date, year, bgRe, discRe, tagsRe));
      i = blockEnd;
      continue;
    }
    i++;
  }
  return items;
}

function findBlockEnd(lines: string[], start: number): number {
  for (let j = start; j < lines.length; j++) {
    if (lines[j].trim() === "---") return j;
  }
  return lines.length;
}

function buildItem(
  block: string[],
  lang: Lang,
  date: string,
  year: number,
  bgRe: RegExp,
  discRe: RegExp,
  tagsRe: RegExp,
): ParsedItem {
  const text = block.join("\n");
  const headingMatch = text.match(HEADING_RE);
  if (!headingMatch) throw new Error(`Could not parse item heading: ${text.slice(0, 80)}`);
  const [, title, url, scoreStr] = headingMatch;
  const score = parseFloat(scoreStr);

  const headingLineEnd = text.indexOf("\n");
  const afterHeading = text.slice(headingLineEnd + 1);

  const detailsMatch = afterHeading.match(DETAILS_RE);
  const withoutDetails = detailsMatch ? afterHeading.replace(detailsMatch[0], "") : afterHeading;

  const bgMatch = withoutDetails.match(bgRe);
  const discMatch = withoutDetails.match(discRe);
  const tagsMatch = withoutDetails.match(tagsRe);

  const context = bgMatch ? bgMatch[1].trim() : "";
  const discussion = discMatch ? discMatch[1].trim() : "";
  const tags = tagsMatch ? parseTags(tagsMatch[1]) : [];

  const references = detailsMatch ? parseReferences(detailsMatch[0]) : [];

  const summary = extractSummary(withoutDetails);
  const sourceLine = extractSourceLine(withoutDetails, lang, date, year);

  return {
    id: makeId(url, date, lang),
    canonicalId: makeCanonicalId(url),
    slugBase: slugify(title),
    date,
    publishedAt: sourceLine.publishedAt ?? `${date}T00:00:00Z`,
    lang,
    title: title.trim(),
    summary,
    score,
    tags,
    sources: [
      { platform: sourceLine.platform, author: sourceLine.author, discussionUrl: sourceLine.discussionUrl },
    ],
    originalUrl: url,
    originalSite: hostnameOf(url),
    context,
    discussion,
    references,
  };
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().replace(/`/g, "").replace(/^#/, ""))
    .filter(Boolean);
}

function extractSummary(text: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex(
    (l) => l.trim() !== "" && !HEADING_RE.test(l) && !l.startsWith("**") && !l.startsWith("<details"),
  );
  if (start === -1) return "";
  const end = lines.findIndex((l, idx) => idx > start && /^[a-z]/i.test(l) && l.includes("·"));
  const summaryEnd = end === -1 ? lines.length : end;
  return lines.slice(start, summaryEnd).join("\n").trim();
}

function extractSourceLine(text: string, lang: Lang, date: string, year: number) {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => /^[a-z]/i.test(l.trim()) && l.includes("·"));
  if (idx === -1)
    return {
      platform: "unknown",
      publishedAt: null as string | null,
      author: undefined,
      discussionUrl: undefined,
    };
  return parseSourceLine(lines[idx].trim(), lang, year);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
