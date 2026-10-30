import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { fr } from "@/lib/strings.fr";

/** Header + content frame for the signed-in spaces. */
export function AppShell({ home, children }: { home: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--line-warm)] bg-[color-mix(in_srgb,var(--cream)_92%,transparent)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link href={home} aria-label={fr.app.name}>
            <Image
              src="/logo.png"
              alt={fr.app.name}
              width={765}
              height={372}
              className="h-10 w-auto"
            />
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
