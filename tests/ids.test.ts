import { describe, it, expect } from "vitest";
import { makeId, makeCanonicalId } from "@/shared/ids";

describe("ids", () => {
  const url = "https://openai.com/index/introducing-gpt-live/";
  const date = "2026-07-08";

  it("makeId is stable and 40-char hex", () => {
    const id = makeId(url, date, "en");
    expect(id).toMatch(/^[0-9a-f]{40}$/);
    expect(makeId(url, date, "en")).toBe(id);
  });

  it("makeId differs by lang for the same url+date", () => {
    expect(makeId(url, date, "en")).not.toBe(makeId(url, date, "zh"));
  });

  it("makeCanonicalId is stable and lang-independent", () => {
    expect(makeCanonicalId(url)).toMatch(/^[0-9a-f]{40}$/);
    expect(makeCanonicalId(url)).toBe(makeCanonicalId(url));
  });
});
