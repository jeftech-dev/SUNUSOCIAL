import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { fr } from "@/lib/strings.fr";
import { whatsappLink } from "@/lib/whatsapp";

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
      <WhatsAppFooter />
    </div>
  );
}

/** "Nous contacter sur WhatsApp" for in-kind gifts and questions (PRD 5.9). Hidden without a number. */
function WhatsAppFooter() {
  if (!whatsappLink(fr.whatsapp.message)) return null;
  return (
    <footer className="border-t border-[var(--line-warm)]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-muted-foreground sm:px-8">
        <span>{fr.whatsapp.footer}</span>
        <WhatsAppButton />
      </div>
    </footer>
  );
}
