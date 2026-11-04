import { describe, expect, it } from "vitest";
import {
  BLOOD_ALERT_DURATION_MS,
  alertDeadline,
  isValidSlot,
  slotLabel,
  slotOptions,
} from "./bloodSlots";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const day0 = Date.UTC(2026, 10, 10);

describe("slotOptions", () => {
  it("offers only future windows today and tomorrow", () => {
    const options = slotOptions(day0 + 11 * HOUR, day0 + 10 * DAY);
    expect(options[0].start).toBe(day0 + 12 * HOUR);
    expect(options).toHaveLength(3 + 5);
    expect(options.every((o) => o.end - o.start === 2 * HOUR)).toBe(true);
  });

  it("stops at the deadline", () => {
    const options = slotOptions(day0 + 7 * HOUR, day0 + 13 * HOUR);
    expect(options.map((o) => o.start)).toEqual([8, 10, 12].map((h) => day0 + h * HOUR));
  });

  it("is empty when nothing is left", () => {
    expect(slotOptions(day0 + 20 * HOUR, day0 + 21 * HOUR)).toEqual([]);
  });

  it("validates a start against the options", () => {
    expect(isValidSlot(day0 + 14 * HOUR, day0 + 9 * HOUR, day0 + DAY)).toBe(true);
    expect(isValidSlot(day0 + 15 * HOUR, day0 + 9 * HOUR, day0 + DAY)).toBe(false);
  });
});

describe("slotLabel", () => {
  it("is relative to now", () => {
    expect(slotLabel(day0 + 14 * HOUR, day0 + HOUR)).toBe("aujourd'hui entre 14 h et 16 h");
    expect(slotLabel(day0 + DAY + 8 * HOUR, day0 + HOUR)).toBe("demain entre 8 h et 10 h");
  });
});

describe("alertDeadline", () => {
  it("uses the stored deadline or derives it from the level", () => {
    expect(alertDeadline({ level: "vitale", createdAt: 5, deadlineAt: 99 })).toBe(99);
    expect(alertDeadline({ level: "urgente", createdAt: 5 })).toBe(
      5 + BLOOD_ALERT_DURATION_MS.urgente,
    );
  });
});
