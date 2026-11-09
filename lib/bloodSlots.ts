// Blood-alert deadlines and visit slots. Pure, shared by Convex and the UI.
// Senegal is on UTC all year, so UTC hours are Dakar hours.

import { fr } from "./strings.fr";
import type { BloodAlertLevel } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How long an alert stays open, by level (interim BLOOD-A, from the prototype copy). */
export const BLOOD_ALERT_DURATION_MS: Record<BloodAlertLevel, number> = {
  vitale: DAY_MS,
  urgente: 3 * DAY_MS,
  normale: 14 * DAY_MS,
};

export const BLOOD_ALERTS_PER_HOUR = 20;
export const BLOOD_FANOUT_BATCH = 200;
export const THANKS_MIN_LENGTH = 10;
export const THANKS_MAX_LENGTH = 300;
export const REMINDER_LEAD_MS = 2 * HOUR_MS;

/** Start hours (UTC) of the 2-hour windows a donor can pick. */
const SLOT_START_HOURS = [8, 10, 12, 14, 16] as const;
export const SLOT_LENGTH_MS = 2 * HOUR_MS;

export interface SlotOption {
  start: number;
  end: number;
}

export function alertDeadline(alert: {
  level: BloodAlertLevel;
  createdAt: number;
  deadlineAt?: number;
}): number {
  return alert.deadlineAt ?? alert.createdAt + BLOOD_ALERT_DURATION_MS[alert.level];
}

/** Windows today and tomorrow that start after `now` and before `deadlineAt`. */
export function slotOptions(now: number, deadlineAt: number): SlotOption[] {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const options: SlotOption[] = [];
  for (const dayStart of [today, today + DAY_MS]) {
    for (const hour of SLOT_START_HOURS) {
      const start = dayStart + hour * HOUR_MS;
      if (start > now && start < deadlineAt) {
        options.push({ start, end: start + SLOT_LENGTH_MS });
      }
    }
  }
  return options;
}

export function isValidSlot(start: number, now: number, deadlineAt: number): boolean {
  return slotOptions(now, deadlineAt).some((option) => option.start === start);
}

/** "aujourd'hui entre 14 h et 16 h" / "demain entre 8 h et 10 h" / "le 12 novembre entre …". */
export function slotLabel(start: number, now: number): string {
  const startHour = new Date(start).getUTCHours();
  const hours = fr.blood.slotTime.hours(startHour, startHour + SLOT_LENGTH_MS / HOUR_MS);
  const dayDiff = Math.floor(start / DAY_MS) - Math.floor(now / DAY_MS);
  if (dayDiff === 0) return fr.blood.slotTime.today(hours);
  if (dayDiff === 1) return fr.blood.slotTime.tomorrow(hours);
  const date = new Date(start);
  return fr.blood.slotTime.onDate(date.getUTCDate(), date.getUTCMonth() + 1, hours);
}
