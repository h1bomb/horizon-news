import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("feed generation", () => {
  it("writes valid atom feeds for en and zh", () => {
    const dir = mkdtempSync(join(tmpdir(), "feeds-"));
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      // copy fixture content into ./content so loadIndex() resolves it
      cpSync(join(__dirname, "fixtures", "content"), join(dir, "content"), { recursive: true });
      cpSync(join(prevCwd, "public"), join(dir, "public"), { recursive: true });
      execFileSync(
        join(prevCwd, "node_modules", ".bin", "tsx"),
        ["--tsconfig", join(prevCwd, "tsconfig.json"), join(prevCwd, "scripts", "generate-feeds.ts")],
        { cwd: dir, stdio: "inherit" },
      );
      for (const lang of ["en", "zh"] as const) {
        const f = join(dir, "public", `feed-${lang}.xml`);
        expect(existsSync(f)).toBe(true);
        const xml = readFileSync(f, "utf8");
        expect(xml).toContain("<feed");
        expect(xml).toContain("<entry>");
      }
    } finally {
      process.chdir(prevCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
