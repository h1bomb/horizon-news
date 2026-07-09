import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { Lang } from "@/shared/schema";

const LANGS: Lang[] = ["en", "zh"];

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const langOk = lang === "en" || lang === "zh" ? (lang as Lang) : "en";
  return (
    <div className="flex min-h-screen flex-col">
      <Header lang={langOk} />
      <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) return {};
  return { html: { lang } };
}
