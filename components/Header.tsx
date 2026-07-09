import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Lang } from "@/shared/schema";

export function Header({ lang }: { lang: Lang }) {
  const t = lang === "zh" ? { news: "资讯", archive: "归档", about: "关于" } : { news: "News", archive: "Archive", about: "About" };
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href={`/${lang}/`} className="text-lg font-semibold">Horizon Daily</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/${lang}/`} className="hover:underline">{t.news}</Link>
          <Link href={`/${lang}/archive/`} className="hover:underline">{t.archive}</Link>
          <Link href={`/${lang}/about/`} className="hover:underline">{t.about}</Link>
          <LanguageSwitcher lang={lang} />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
