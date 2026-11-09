import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/strings.fr";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
      <h1 className="font-heading text-3xl font-extrabold text-brand-blue">
        {fr.states.notFoundTitle}
      </h1>
      <p className="text-muted-foreground">{fr.states.notFoundBody}</p>
      <Link href="/" className={buttonVariants()}>
        {fr.states.backHome}
      </Link>
    </main>
  );
}
