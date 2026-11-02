// Scheduled jobs (convex-cron-jobs). Times are UTC, which is also Senegal's time zone.

import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Receipts uploaded during signups that were never finished (convex/files.ts).
crons.daily(
  "purge abandoned signup uploads",
  { hourUTC: 3, minuteUTC: 17 },
  internal.files.purgeAbandonedUploads,
  {},
);

// Pending payments whose webhook was missed, and transactions abandoned for 2 h (convex/payments.ts, DT-3).
crons.interval("recheck pending payments", { minutes: 10 }, internal.payments.recheckPending, {});

// --- Payouts and fund rules (Sprint 6, DT-4/DT-24/DT-25) ---

// The single-flight payout worker: drains queued payouts one at a time (convex/payouts.ts, DT-4).
crons.interval("drain payouts", { seconds: 30 }, internal.payouts.drainNext, {});

// Release held funds for causes past their deadline (or goal-closed) in one lump-sum payout (DT-24).
crons.hourly("release due causes", { minuteUTC: 5 }, internal.payments.releaseDue, {});

// Pay out the net of late payments flagged for automatic refund (DB-18, DT-7).
crons.interval("late-payment refunds", { minutes: 15 }, internal.payments.lateRefundDue, {});

// Suspend structures that missed a proof deadline (DB-12, DT-25).
crons.hourly("enforce proof deadlines", { minuteUTC: 20 }, internal.payments.enforceProofDeadlines, {});

// Poll payouts in NabooPay manual review (> 2M XOF) until they resolve (DT-4).
crons.interval("poll payout reviews", { minutes: 10 }, internal.payouts.pollPendingReview, {});

// Safety net: reconcile payouts left in an `unknown` state after a timeout/5xx (DT-4).
crons.interval("reconcile unknown payouts", { minutes: 10 }, internal.payouts.reconcileUnknown, {});

// Daily ledger drift check against the NabooPay balance (DT-4).
crons.daily("ledger check", { hourUTC: 4, minuteUTC: 0 }, internal.payouts.dailyLedgerCheck, {});

export default crons;
