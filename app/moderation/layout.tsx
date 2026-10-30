import type { Metadata } from "next";
import Image from "next/image";

import { fr } from "@/lib/strings.fr";

// Served only on moderation.<domain> (proxy.ts rewrites it; the main host answers 404).
export const metadata: Metadata = {
  title: fr.moderation.title,
  robots: { index: false, follow: false },
};

export default function ModerationLayout({ children }: LayoutProps<"/moderation">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand-blue text-primary-foreground">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-8">
          <Image
            src="/logo.png"
            alt={fr.app.name}
            width={765}
            height={372}
            className="h-9 w-auto rounded bg-card p-1"
          />
          <span className="text-xs font-bold tracking-widest">{fr.moderation.badge}</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
