import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { fr } from "@/lib/strings.fr";
import type { CauseCardView } from "@/lib/types";

import { CauseBanner } from "./CauseBanner";
import { CauseProgress } from "./CauseProgress";
import { CauseTags } from "./CauseTags";

/** A cause in the feed: banner, verified organisation, title, progress and "Voir plus". */
export function CauseCard({ cause }: { cause: CauseCardView }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-[var(--line-warm)] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="relative">
        <CauseBanner
          url={cause.bannerUrl}
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
          className="aspect-[16/10]"
        />
        <CauseTags category={cause.category} urgent={cause.urgent} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {cause.organization.name}
          {cause.organization.verified && <VerifiedBadge />}
        </p>
        <h3 className="font-heading text-[17px] leading-snug font-bold">{cause.title}</h3>
        <CauseProgress
          raised={cause.raised}
          goal={cause.goal}
          percent={cause.percent}
          className="mt-auto"
        />
        <Link
          href={`/causes/${cause.id}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
          aria-label={`${fr.common.seeMore} : ${cause.title}`}
        >
          {fr.common.seeMore}
        </Link>
      </div>
    </article>
  );
}
