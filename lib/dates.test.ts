import { describe, expect, it } from "vitest";

import { daysUntil, formatDate } from "./dates";

describe("formatDate", () => {
  it("writes the day, the French month and the year", () => {
    expect(formatDate(Date.UTC(2026, 11, 15, 23, 59))).toBe("15 décembre 2026");
    expect(formatDate(Date.UTC(2027, 0, 1))).toBe("1 janvier 2027");
    expect(formatDate(Date.UTC(2026, 7, 5))).toBe("5 août 2026");
  });
});

describe("daysUntil", () => {
  it("counts calendar days in Dakar time", () => {
    const now = Date.UTC(2026, 9, 30, 18, 0);
    expect(daysUntil(Date.UTC(2026, 9, 30, 23, 0), now)).toBe(0);
    expect(daysUntil(Date.UTC(2026, 9, 31, 1, 0), now)).toBe(1);
    expect(daysUntil(Date.UTC(2026, 10, 6, 12, 0), now)).toBe(7);
    expect(daysUntil(Date.UTC(2026, 9, 29, 12, 0), now)).toBe(-1);
  });
});
