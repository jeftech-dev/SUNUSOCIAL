// Date formatting for French UI copy. Senegal is on UTC all year (no DST), so dates are computed
// in UTC by hand: the server and the browser render the same text (no ICU drift).

import { fr } from "./strings.fr";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `formatDate(Date.UTC(2026, 11, 15))` → "15 décembre 2026". */
export function formatDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${fr.dates.months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Whole calendar days from `now` to `until` in Dakar time: 0 on the last day, negative after. */
export function daysUntil(until: number, now: number): number {
  return Math.floor(until / DAY_MS) - Math.floor(now / DAY_MS);
}
