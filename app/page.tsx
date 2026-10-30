import Image from "next/image";
import Link from "next/link";

import { LocationDemo } from "@/components/common/LocationDemo";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/strings.fr";

// Temporary Sprint 1 page: shows the charte (fonts, colours, buttons) and the region → commune
// lists. The real landing (prototype screen 01) replaces it in a later sprint.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Image
          src="/logo.png"
          alt={fr.app.name}
          width={765}
          height={372}
          priority
          className="h-12 w-auto"
        />
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          {fr.foundations.badge}
        </span>
      </header>

      <section className="flex flex-col gap-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-green-strong">
          {fr.app.tagline}
        </p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-brand-blue sm:text-5xl">
          {fr.landing.headline}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{fr.landing.intro}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/inscription">{fr.landing.ctaDonor}</Link>
          </Button>
          <Button asChild size="lg" variant="cta">
            <Link href="/inscription?role=org">{fr.landing.ctaStructure}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/connexion">{fr.nav.login}</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          {Object.values(fr.landing.trust).map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full bg-brand-green" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{fr.foundations.locationTitle}</h2>
          <p className="text-sm text-muted-foreground">{fr.foundations.locationHint}</p>
        </div>
        <LocationDemo />
      </section>
    </main>
  );
}
