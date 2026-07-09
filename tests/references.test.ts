import { describe, it, expect } from "vitest";
import { parseReferences } from "@/worker/parser/references";

describe("parseReferences", () => {
  it("parses a details block with links", () => {
    const html = `<details><summary>References</summary>\n<ul>\n<li><a href="https://en.wikipedia.org/wiki/Chat_Control">Chat Control - Wikipedia</a></li>\n<li><a href="https://edri.org/our-work/">EDRi</a></li>\n\n</ul>\n</details>`;
    const refs = parseReferences(html);
    expect(refs).toEqual([
      { title: "Chat Control - Wikipedia", url: "https://en.wikipedia.org/wiki/Chat_Control" },
      { title: "EDRi", url: "https://edri.org/our-work/" },
    ]);
  });

  it("returns [] when there is no details block", () => {
    expect(parseReferences("just some text")).toEqual([]);
  });

  it("ignores li items without an anchor", () => {
    const html = `<details><summary>References</summary>\n<ul>\n<li>no link here</li>\n<li><a href="https://x.com">X</a></li>\n</ul>\n</details>`;
    const refs = parseReferences(html);
    expect(refs).toEqual([{ title: "X", url: "https://x.com" }]);
  });
});
