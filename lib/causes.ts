// Feed rules shared by Convex and the UI (DT-34).

import type { Cause, EndCondition } from "./types";

/** A cause is "Presque atteint" from this share of its goal (the prototype's threshold). */
export const ALMOST_REACHED_PERCENT = 75;

/** Progress as an integer percentage, rounded down so 100 % only shows once the goal is met. */
export function percentOf(raised: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.floor((raised * 100) / goal));
}

/** Same test as the `almost` filter of `causes.list`, in integer arithmetic. */
export function isAlmostReached(raised: number, goal: number): boolean {
  return raised * 100 >= goal * ALMOST_REACHED_PERCENT;
}

export function endConditionOf(cause: Pick<Cause, "endType" | "deadline">): EndCondition {
  return { type: cause.endType, deadline: cause.deadline };
}
