import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

import { ProgressBar } from "./ProgressBar";

/** Progress bar with "raised / goal" and the percentage underneath. */
export function CauseProgress({
  raised,
  goal,
  percent,
  className,
}: {
  raised: number;
  goal: number;
  percent: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ProgressBar
        raised={raised}
        goal={goal}
        percent={percent}
        label={fr.causeDetail.reached(percent)}
      />
      <div className="flex items-baseline justify-between gap-2 text-sm text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">{formatFCFA(raised)}</strong> /{" "}
          {formatFCFA(goal)}
        </span>
        <span className="font-heading font-bold text-foreground">{percent}&nbsp;%</span>
      </div>
    </div>
  );
}
