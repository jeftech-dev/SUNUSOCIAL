import Image from "next/image";
import Link from "next/link";

import { fr } from "@/lib/strings.fr";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Link href="/" aria-label={fr.app.name}>
          <Image
            src="/logo.png"
            alt={fr.app.name}
            width={765}
            height={372}
            priority
            className="h-11 w-auto"
          />
        </Link>
        <Link href="/" className="text-sm font-semibold">
          {fr.auth.back}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16">
        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
