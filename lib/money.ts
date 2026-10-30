// Money arithmetic (DT-6). Every amount is an integer number of FCFA (XOF); never a float.
// The invariant `fee + platformFee + net === amount` holds for every result of this module.

import { config } from "./config";
import type { FeeBreakdown, Provider } from "./types";

/**
 * Estimated provider fee rate, shown before payment. Once paid, the stored fee is NabooPay's
 * actual `fees` (see `settle`).
 */
export const PROVIDER_RATE: Record<Provider, number> = {
  naboopay: 0.03,
  mock: 0.03,
};

function assertAmount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer FCFA amount, got ${value}`);
  }
}

function assertRate(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`${name} must be a rate in [0, 1), got ${value}`);
  }
}

/** Rounds `amount × rate` to the nearest integer FCFA. */
function share(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

/**
 * The fee breakdown shown before payment and recomputed on the server at checkout.
 * `fee = round(amount × provider rate)`, `platformFee = round(amount × platformFeeRate)`,
 * `net = amount − fee − platformFee`.
 */
export function computeFee(
  amount: number,
  provider: Provider,
  platformFeeRate: number = config.platformFeeRate,
): FeeBreakdown {
  assertAmount(amount, "amount");
  const feeRate = PROVIDER_RATE[provider];
  assertRate(platformFeeRate, "platformFeeRate");
  if (feeRate + platformFeeRate >= 1) {
    throw new RangeError("fee rate and platform fee rate together must stay below 1");
  }
  const fee = share(amount, feeRate);
  const platformFee = share(amount, platformFeeRate);
  return {
    amount,
    provider,
    feeRate,
    fee,
    platformFeeRate,
    platformFee,
    net: amount - fee - platformFee,
  };
}

export interface Settlement {
  amount: number;
  fee: number;
  platformFee: number;
  net: number;
}

/**
 * The amounts stored once a donation is paid, from NabooPay's actual fee.
 * Throws if the fees exceed the amount.
 */
export function settle(
  amount: number,
  actualFee: number,
  platformFeeRate: number = config.platformFeeRate,
): Settlement {
  assertAmount(amount, "amount");
  assertAmount(actualFee, "actualFee");
  assertRate(platformFeeRate, "platformFeeRate");
  const platformFee = share(amount, platformFeeRate);
  const net = amount - actualFee - platformFee;
  if (net < 0) {
    throw new RangeError(`fees (${actualFee} + ${platformFee}) exceed the amount (${amount})`);
  }
  return { amount, fee: actualFee, platformFee, net };
}

/** True when `amount` is an integer FCFA amount of at least MIN_DONATION (DB-14). */
export function isValidDonationAmount(
  amount: number,
  minDonation: number = config.minDonation,
): boolean {
  return Number.isSafeInteger(amount) && amount >= minDonation;
}

const THOUSANDS_SEPARATOR = " "; // narrow no-break space (French typography)
const UNIT_SEPARATOR = " "; // no-break space

/**
 * Formats an integer FCFA amount: `formatFCFA(4500)` → "4 500 FCFA".
 * Grouping is done by hand so the server and the browser render identically (no ICU drift).
 */
export function formatFCFA(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`amount must be an integer FCFA amount, got ${amount}`);
  }
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  return `${sign}${digits}${UNIT_SEPARATOR}FCFA`;
}
