import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/shared/schema";

export function TagList({ tags, lang }: { tags: string[]; lang: Lang }) {
  if (!tags.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Link key={t} href={`/${lang}/tag/${encodeURIComponent(t)}/`}>
          <Badge variant="outline">#{t}</Badge>
        </Link>
      ))}
    </div>
  );
}
