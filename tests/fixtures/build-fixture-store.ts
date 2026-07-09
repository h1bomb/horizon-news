import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseBriefing, type ParsedBriefing } from "@/worker/parser/parse";
import { writeContentStore } from "@/worker/write-store";

const FIXTURE_DIR = resolve(__dirname);
const OUT_DIR = resolve(__dirname, "content");

async function main() {
  const briefings: ParsedBriefing[] = [];
  for (const file of readdirSync(FIXTURE_DIR)) {
    if (!/-summary-(en|zh)\.md$/.test(file)) continue;
    const lang = file.endsWith("-en.md") ? "en" : "zh";
    const date = file.match(/^(\d{4}-\d{2}-\d{2})/)![1];
    const md = readFileSync(join(FIXTURE_DIR, file), "utf8");
    briefings.push(parseBriefing(md, lang, date));
  }
  const enrich = new Map<string, { fullText: null; image: null }>();
  for (const b of briefings) for (const it of b.items) enrich.set(it.id, { fullText: null, image: null });
  await writeContentStore(OUT_DIR, briefings, enrich, { horizonCommit: "fixture", workerVersion: "0.1.0" });
  console.log(`> Wrote fixture content store to ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
