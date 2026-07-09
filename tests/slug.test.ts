import { describe, it, expect } from "vitest";
import { slugify } from "@/shared/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("OpenAI Launches GPT-Live")).toBe("openai-launches-gpt-live");
  });
  it("strips non-alphanumeric (keeps CJK)", () => {
    expect(slugify("欧盟即将重启消息扫描规则")).toBe("欧盟即将重启消息扫描规则");
  });
  it("collapses whitespace and trims", () => {
    expect(slugify("  Cloudflare   Meerkat  ")).toBe("cloudflare-meerkat");
  });
  it("falls back to a short hash when empty", () => {
    expect(slugify("!!!")).toMatch(/^item-[0-9a-f]{8}$/);
  });
});
