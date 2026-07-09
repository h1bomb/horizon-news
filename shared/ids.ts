import { createHash } from "node:crypto";
import type { Lang } from "@/shared/schema";

export function sha1Hex(input: string): string {
  return createHash("sha1").update(input, "utf8").digest("hex");
}

export function makeCanonicalId(url: string): string {
  return sha1Hex(normalizeUrl(url));
}

export function makeId(url: string, date: string, lang: Lang): string {
  return sha1Hex(`${normalizeUrl(url)}|${date}|${lang}`);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}
