import { isAlmostReached } from "@/lib/causes";
import { cn } from "@/lib/utils";

/** Cause progress. Green once "Presque atteint", blue before (as in the prototype). */
export function ProgressBar({
  raised,
  goal,
  percent,
  label,
  className,
}: {
  raised: number;
  goal: number;
  percent: number;
  /** Accessible name, e.g. "45 % atteint". */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
          isAlmostReached(raised, goal) ? "bg-brand-green" : "bg-brand-blue",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
