import { fr } from "@/lib/strings.fr";
import type { CauseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** How far along the Soumise → En modération → Approuvée → Active → Clôturée timeline a status is. */
const REACHED: Record<CauseStatus, number> = {
  withdrawn: 0,
  deleted: 0,
  pending_review: 1,
  refused: 1,
  active: 3,
  closed: 4,
};

/** The structure's cause lifecycle as a compact stepper (PARCOURS S12). */
export function CauseStatusTimeline({ status }: { status: CauseStatus }) {
  const reached = REACHED[status];
  const bad = status === "refused" || status === "withdrawn";
  return (
    <ol
      aria-label={fr.causeStatus[status]}
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
    >
      {fr.causeTimeline.map((label, i) => {
        const isCurrent = i === reached;
        const done = i < reached;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                isCurrent && bad
                  ? "bg-[var(--danger-soft)] text-destructive"
                  : isCurrent
                    ? "bg-primary-soft text-brand-blue"
                    : done
                      ? "text-brand-green-strong"
                      : "text-muted-foreground",
              )}
            >
              {isCurrent && bad ? fr.causeStatus[status] : label}
            </span>
            {i < fr.causeTimeline.length - 1 && (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
