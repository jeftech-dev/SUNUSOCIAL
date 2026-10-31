import { fr } from "@/lib/strings.fr";
import type { Category } from "@/lib/types";

/** The URGENT and category tags laid over a banner. */
export function CauseTags({ category, urgent }: { category: Category; urgent: boolean }) {
  return (
    <>
      {urgent && (
        <span className="absolute top-3 left-3 rounded-full bg-cta px-2.5 py-1 font-heading text-[11px] font-bold tracking-wide text-cta-foreground">
          {fr.feed.urgentTag}
        </span>
      )}
      <span className="absolute top-3 right-3 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-brand-blue">
        {fr.categories[category]}
      </span>
    </>
  );
}
