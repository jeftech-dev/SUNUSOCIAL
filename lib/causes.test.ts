import { describe, expect, it } from "vitest";

import { ALMOST_REACHED_PERCENT, endConditionOf, isAlmostReached, percentOf } from "./causes";

describe("percentOf", () => {
  it("returns an integer percentage, rounded down", () => {
    expect(percentOf(4_500, 10_000)).toBe(45);
    expect(percentOf(312_000, 360_000)).toBe(86);
    expect(percentOf(9_999, 10_000)).toBe(99);
    expect(percentOf(0, 10_000)).toBe(0);
  });

  it("caps at 100 and survives a zero goal", () => {
    expect(percentOf(10_000, 10_000)).toBe(100);
    expect(percentOf(15_000, 10_000)).toBe(100);
    expect(percentOf(500, 0)).toBe(0);
  });
});

describe("isAlmostReached", () => {
  it("starts exactly at the threshold", () => {
    expect(ALMOST_REACHED_PERCENT).toBe(75);
    expect(isAlmostReached(7_500, 10_000)).toBe(true);
    expect(isAlmostReached(7_499, 10_000)).toBe(false);
    expect(isAlmostReached(55_000, 55_000)).toBe(true);
  });
});

describe("endConditionOf", () => {
  it("keeps the end type and the deadline", () => {
    expect(endConditionOf({ endType: "goal", deadline: 1_765_756_800_000 })).toEqual({
      type: "goal",
      deadline: 1_765_756_800_000,
    });
  });
});
