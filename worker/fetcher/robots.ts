import robotsParser from "robots-parser";

export function isAllowed(url: string, robotsTxt: string): boolean {
  if (!robotsTxt.trim()) return true;
  const base = `${new URL(url).protocol}//${new URL(url).hostname}`;
  const robots = robotsParser(`${base}/robots.txt`, robotsTxt);
  return robots.isAllowed(url) ?? true;
}

export interface RobotChecker {
  allowed(url: string): boolean;
  crawlDelay(url: string): number | undefined;
}

export async function loadRobots(url: string): Promise<RobotChecker> {
  const base = `${new URL(url).protocol}//${new URL(url).hostname}`;
  const robotsUrl = `${base}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { allowed: () => true, crawlDelay: () => undefined };
    const txt = await res.text();
    const robots = robotsParser(robotsUrl, txt);
    return {
      allowed: (u: string) => robots.isAllowed(u) ?? true,
      crawlDelay: (u: string) => robots.getCrawlDelay(u) ?? undefined,
    };
  } catch {
    return { allowed: () => true, crawlDelay: () => undefined };
  }
}
