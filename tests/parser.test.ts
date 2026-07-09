import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stripFrontmatter } from "@/worker/parser/frontmatter";

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf8");
}

describe("stripFrontmatter", () => {
  it("strips Jekyll front matter and returns body + lang + date", () => {
    const { body, lang, date } = stripFrontmatter(fixture("2026-07-08-summary-en.md"));
    expect(lang).toBe("en");
    expect(date).toBe("2026-07-08");
    expect(body.startsWith("> From 40 items")).toBe(true);
    expect(body).not.toContain("layout: default");
  });

  it("parses zh front matter", () => {
    const { body, lang, date } = stripFrontmatter(fixture("2026-07-08-summary-zh.md"));
    expect(lang).toBe("zh");
    expect(date).toBe("2026-07-08");
    expect(body.startsWith("> 从 40 条内容")).toBe(true);
  });

  it("handles a briefing with no front matter (returns whole input)", () => {
    const md = "> From 1 items, 1 selected\n\n---\n";
    const { body, lang, date } = stripFrontmatter(md, "en", "2026-01-01");
    expect(body).toBe(md);
    expect(lang).toBe("en");
    expect(date).toBe("2026-01-01");
  });
});
