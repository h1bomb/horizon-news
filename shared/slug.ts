import { createHash } from "node:crypto";

export function slugify(text: string): string {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (cleaned) return cleaned;
  return "item-" + createHash("sha1").update(text).digest("hex").slice(0, 8);
}
