"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    const pref = navigator.language.toLowerCase();
    const lang = pref.startsWith("zh") ? "zh" : "en";
    router.replace(`/${lang}/`);
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-muted-foreground">
      Redirecting…
    </main>
  );
}
