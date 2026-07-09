"use client";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Lang } from "@/shared/schema";

export function LanguageSwitcher({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  function target(l: Lang): string {
    return pathname.replace(/^\/(en|zh)(\/|$)/, `/${l}$2`) || `/${l}/`;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm">{lang === "zh" ? "中/EN" : "EN/中"}</Button>}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<a href={target("en")} hrefLang="en">English</a>} />
        <DropdownMenuItem render={<a href={target("zh")} hrefLang="zh">中文</a>} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
