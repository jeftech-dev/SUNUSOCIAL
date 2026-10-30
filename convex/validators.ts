// Reusable Convex validators, built from the shared enumerations in lib/types.ts.

import { v, type VLiteral, type VUnion } from "convex/values";

import {
  BLOOD_ALERT_LEVELS,
  BLOOD_TYPES,
  CATEGORIES,
  CAUSE_STATUSES,
  DELETION_STATUSES,
  DONATION_STATUSES,
  END_TYPES,
  EXTENSION_KINDS,
  EXTENSION_STATUSES,
  FUND_OUTCOMES,
  METHODS,
  NOTIFICATION_KINDS,
  OTP_PURPOSES,
  PAYOUT_KINDS,
  PAYOUT_STATUSES,
  PROOF_DEADLINE_REASONS,
  PROOF_ITEM_KINDS,
  PROOF_STATUSES,
  PROVIDERS,
  REFUND_STATUSES,
  ROLES,
  STRUCTURE_STATUSES,
  STRUCTURE_TYPES,
  URGENCIES,
} from "../lib/types";

/** `v.union(v.literal(a), v.literal(b), …)` from a readonly tuple of strings. */
export function literals<const T extends readonly [string, string, ...string[]]>(values: T) {
  return v.union(...values.map((value) => v.literal(value))) as VUnion<
    T[number],
    Array<VLiteral<T[number], "required">>,
    "required",
    never
  >;
}

export const roleV = literals(ROLES);
export const categoryV = literals(CATEGORIES);
export const urgencyV = literals(URGENCIES);
export const methodV = literals(METHODS);
export const providerV = literals(PROVIDERS);
export const causeStatusV = literals(CAUSE_STATUSES);
export const donationStatusV = literals(DONATION_STATUSES);
export const bloodTypeV = literals(BLOOD_TYPES);
export const bloodAlertLevelV = literals(BLOOD_ALERT_LEVELS);
export const endTypeV = literals(END_TYPES);
export const structureTypeV = literals(STRUCTURE_TYPES);
export const structureStatusV = literals(STRUCTURE_STATUSES);
export const otpPurposeV = literals(OTP_PURPOSES);
export const refundStatusV = literals(REFUND_STATUSES);
export const proofStatusV = literals(PROOF_STATUSES);
export const proofItemKindV = literals(PROOF_ITEM_KINDS);
export const proofDeadlineReasonV = literals(PROOF_DEADLINE_REASONS);
export const deletionStatusV = literals(DELETION_STATUSES);
export const fundOutcomeV = literals(FUND_OUTCOMES);
export const payoutKindV = literals(PAYOUT_KINDS);
export const payoutStatusV = literals(PAYOUT_STATUSES);
export const extensionKindV = literals(EXTENSION_KINDS);
export const extensionStatusV = literals(EXTENSION_STATUSES);
export const notificationKindV = literals(NOTIFICATION_KINDS);

export const onboardingPhaseV = v.union(v.literal(1), v.literal(2));

/** `{ label, amount }`: one line of a spend breakdown or an invoice. Amount in integer FCFA. */
export const spendLineV = v.object({
  label: v.string(),
  amount: v.number(),
});

/**
 * A structure's Orange Money / Wave payout account (DB-15, DT-5).
 * `phoneVerifiedAt`: the number was proven by SMS code. `verifiedAt`/`verifiedBy`: moderator approval.
 */
export const payoutAccountV = v.object({
  method: methodV,
  accountNumber: v.string(),
  holderName: v.string(),
  phoneVerifiedAt: v.number(),
  verifiedAt: v.optional(v.number()),
  verifiedBy: v.optional(v.id("users")),
});
