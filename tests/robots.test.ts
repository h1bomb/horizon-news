import { describe, it, expect } from "vitest";
import { isAllowed } from "@/worker/fetcher/robots";

const sampleTxt = `
User-agent: *
Disallow: /private/
Allow: /
`;

describe("isAllowed", () => {
  it("allows a path not disallowed", () => {
    expect(isAllowed("https://example.com/public/article", sampleTxt)).toBe(true);
  });
  it("disallows a disallowed path", () => {
    expect(isAllowed("https://example.com/private/secret", sampleTxt)).toBe(false);
  });
  it("treats a missing robots.txt as fully allowed", () => {
    expect(isAllowed("https://example.com/anything", "")).toBe(true);
  });
});
