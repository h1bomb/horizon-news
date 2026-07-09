import { describe, it, expect, vi } from "vitest";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBriefing } from "@/worker/parser/parse";
import { writeContentStore } from "@/worker/write-store";

vi.mock("@/worker/clone", () => ({
  cloneHorizonPosts: () => ({ postsDir: "", commit: "deadbeef" }),
}));

describe("worker orchestration (no network)", () => {
  it("parses fixtures and writes a store with fullText null under --no-fetch", async () => {
    const en = parseBriefing(readFileSync(join(__dirname, "fixtures", "2026-07-08-summary-en.md"), "utf8"), "en", "2026-07-08");
    const zh = parseBriefing(readFileSync(join(__dirname, "fixtures", "2026-07-08-summary-zh.md"), "utf8"), "zh", "2026-07-08");
    const dir = mkdtempSync(join(tmpdir(), "orch-"));
    const enrich = new Map<string, { fullText: null; image: null }>();
    for (const it of [...en.items, ...zh.items]) enrich.set(it.id, { fullText: null, image: null });
    await writeContentStore(dir, [en, zh], enrich, { horizonCommit: "deadbeef", workerVersion: "0.1.0" });
    expect(existsSync(join(dir, "meta.json"))).toBe(true);
    expect(existsSync(join(dir, "index.json"))).toBe(true);
    expect(existsSync(join(dir, "articles", "en", `${en.items[0].id}.json`))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
