"use client";

import { useState } from "react";

import { daysUntil, formatDate } from "@/lib/dates";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import type { EndCondition as EndConditionView } from "@/lib/types";

/** When the cause ends: at its date, or at its goal and its date at the latest (DB-5). */
export function EndCondition({
  endCondition,
  goal,
  closed,
}: {
  endCondition: EndConditionView;
  goal: number;
  closed: boolean;
}) {
  const [now] = useState(() => Date.now());
  const date = formatDate(endCondition.deadline);
  const title =
    endCondition.type === "date"
      ? fr.causeDetail.endDate(date)
      : fr.causeDetail.endGoal(formatFCFA(goal));
  const sub =
    endCondition.type === "date"
      ? fr.causeDetail.endDateSub(formatFCFA(goal))
      : fr.causeDetail.endGoalSub(date);

  return (
    <div className="flex items-start gap-3 rounded-lg bg-accent p-3.5">
      <svg
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-brand-orange-strong"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div className="flex flex-col gap-0.5">
        <strong className="text-[15px]">{title}</strong>
        <span className="text-sm text-muted-foreground">{sub}</span>
        {!closed && (
          <span className="text-sm font-semibold text-brand-orange-strong">
            {fr.causeDetail.daysLeft(daysUntil(endCondition.deadline, now))}
          </span>
        )}
      </div>
    </div>
  );
}
