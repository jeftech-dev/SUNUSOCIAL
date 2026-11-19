import Link from "next/link";

import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { fr } from "@/lib/strings.fr";
import type { CauseCardView } from "@/lib/types";

import { CauseBanner } from "./CauseBanner";
import { CauseProgress } from "./CauseProgress";

/** The "Coup de cœur de la semaine" panel at the top of the feed (DB-6). */
export function FeaturedCause({ cause }: { cause: CauseCardView }) {
  return (
    <article className="relative grid overflow-hidden rounded-xl bg-brand-blue text-white md:grid-cols-[1.1fr_1fr]">
      <div className="relative">
        <CauseBanner
          url={cause.bannerUrl}
          sizes="(min-width: 768px) 520px, 100vw"
          priority
          className="aspect-[16/10] h-full md:aspect-auto md:min-h-72"
        />
        <span className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-brand-orange px-3.5 py-2 font-heading text-xs font-bold tracking-wide text-foreground">
          ♥ {fr.common.featured}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:p-7">
        <span className="text-xs font-semibold tracking-wide text-white/85 uppercase">
          {fr.feed.editorial}
        </span>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
          {cause.organization.name}
          {cause.organization.verified && (
            <VerifiedBadge className="rounded-full bg-white px-2 py-0.5 text-xs" />
          )}
        </p>
        <h2 className="font-heading text-2xl leading-tight font-extrabold">{cause.title}</h2>
        <div className="rounded-lg bg-white p-3 text-foreground">
          <CauseProgress raised={cause.raised} goal={cause.goal} percent={cause.percent} />
        </div>
        <Link
          href={`/causes/${cause.id}`}
          className="mt-auto self-start font-heading text-sm font-bold underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {fr.feed.seeCause}
        </Link>
      </div>
    </article>
  );
}
