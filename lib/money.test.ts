import { describe, expect, it } from "vitest";

import { PROVIDERS } from "./types";
import { computeFee, formatFCFA, isValidDonationAmount, PROVIDER_RATE, settle } from "./money";

const NNBSP = " ";
const NBSP = " ";

describe("computeFee", () => {
  it("keeps fee + platformFee + net === amount for every amount, provider and rate", () => {
    const rates = [0, 0.01, 0.025, 0.05, 0.1, 0.333];
    for (const provider of PROVIDERS) {
      for (const rate of rates) {
        for (let amount = 0; amount <= 20_000; amount += 1) {
          const b = computeFee(amount, provider, rate);
          expect(b.fee + b.platformFee + b.net).toBe(amount);
        }
      }
    }
  });

  it("keeps the invariant on large amounts", () => {
    let seed = 42;
    const next = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31);
    for (let i = 0; i < 5_000; i += 1) {
      const amount = next() * 1_000 + (next() % 1_000);
      const b = computeFee(amount, "naboopay", 0.02);
      expect(b.fee + b.platformFee + b.net).toBe(amount);
      expect(Number.isSafeInteger(b.fee)).toBe(true);
      expect(Number.isSafeInteger(b.net)).toBe(true);
    }
  });

  it("produces integer amounts only", () => {
    for (let amount = 0; amount <= 5_000; amount += 7) {
      const b = computeFee(amount, "naboopay", 0.015);
      expect(Number.isInteger(b.fee)).toBe(true);
      expect(Number.isInteger(b.platformFee)).toBe(true);
      expect(Number.isInteger(b.net)).toBe(true);
    }
  });

  it("estimates 3% for NabooPay and no platform fee by default", () => {
    expect(computeFee(4_500, "naboopay")).toEqual({
      amount: 4_500,
      provider: "naboopay",
      feeRate: PROVIDER_RATE.naboopay,
      fee: 135,
      platformFeeRate: 0,
      platformFee: 0,
      net: 4_365,
    });
    expect(computeFee(500, "naboopay").fee).toBe(15);
  });

  it("rounds the fee to the nearest FCFA", () => {
    expect(computeFee(16, "naboopay").fee).toBe(0); // 0.48
    expect(computeFee(17, "naboopay").fee).toBe(1); // 0.51
    expect(computeFee(50, "naboopay").fee).toBe(2); // 1.5 rounds up
    expect(computeFee(1_234, "naboopay").fee).toBe(37); // 37.02
  });

  it("rejects non-integer, negative and non-finite amounts", () => {
    for (const bad of [10.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => computeFee(bad, "naboopay")).toThrow(RangeError);
    }
  });

  it("rejects invalid platform fee rates", () => {
    for (const bad of [-0.01, 1, 1.5, Number.NaN]) {
      expect(() => computeFee(1_000, "naboopay", bad)).toThrow(RangeError);
    }
    expect(() => computeFee(1_000, "naboopay", 0.97)).toThrow(RangeError);
  });
});

describe("settle", () => {
  it("uses NabooPay's actual fee and keeps the invariant", () => {
    expect(settle(10_000, 280, 0)).toEqual({
      amount: 10_000,
      fee: 280,
      platformFee: 0,
      net: 9_720,
    });
    const s = settle(10_000, 300, 0.02);
    expect(s.fee + s.platformFee + s.net).toBe(10_000);
    expect(s.platformFee).toBe(200);
  });

  it("refuses fees larger than the amount", () => {
    expect(() => settle(1_000, 1_001, 0)).toThrow(RangeError);
    expect(() => settle(1_000, 990, 0.02)).toThrow(RangeError);
  });

  it("refuses non-integer fees", () => {
    expect(() => settle(1_000, 30.5, 0)).toThrow(RangeError);
  });
});

describe("isValidDonationAmount", () => {
  it("requires an integer of at least MIN_DONATION (500 by default)", () => {
    expect(isValidDonationAmount(499)).toBe(false);
    expect(isValidDonationAmount(500)).toBe(true);
    expect(isValidDonationAmount(500.5)).toBe(false);
    expect(isValidDonationAmount(1_000, 2_000)).toBe(false);
  });
});

describe("formatFCFA", () => {
  it("groups thousands with a narrow no-break space", () => {
    expect(formatFCFA(4_500)).toBe(`4${NNBSP}500${NBSP}FCFA`);
    expect(formatFCFA(0)).toBe(`0${NBSP}FCFA`);
    expect(formatFCFA(999)).toBe(`999${NBSP}FCFA`);
    expect(formatFCFA(1_000_000)).toBe(`1${NNBSP}000${NNBSP}000${NBSP}FCFA`);
    expect(formatFCFA(-12_500)).toBe(`-12${NNBSP}500${NBSP}FCFA`);
  });

  it("refuses non-integer amounts", () => {
    expect(() => formatFCFA(10.5)).toThrow(RangeError);
  });
});
