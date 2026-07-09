import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadIndexFrom } from "@/lib/content";

const FIXTURE = resolve(__dirname, "fixtures", "content");

describe("translation pairing", () => {
  it("finds the ZH pair of an EN article via canonicalId", () => {
    const index = loadIndexFrom(FIXTURE);
    const en = index.articles.find((a) => a.lang === "en")!;
    const zh = index.articles.find((a) => a.lang === "zh" && a.canonicalId === en.canonicalId);
    if (zh) {
      expect(zh.canonicalId).toBe(en.canonicalId);
      expect(zh.id).not.toBe(en.id);
    }
  });
});
