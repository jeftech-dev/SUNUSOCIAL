// The single-flight payout worker (DT-4). Every outgoing transfer — a cause release, a deletion
// payout or a refund — goes through the `payouts` table and is processed one at a time, because
// NabooPay allows only one payout per organisation at a time (a `409` otherwise).
//
// Implementation note (deviation from DT-4's letter, see docs/DECISIONS.md DT-4): the "one at a
// time" guarantee is a cron-driven single-flight claim on `payouts.by_status_created`, not
// `@convex-dev/workpool`. `claimNext` refuses to start a payout while another is `sending`, so
// concurrent cron ticks never run two payouts at once, and the whole path stays testable with
// `convex-test` (no Convex component, no live backend).
//
// Golden rule: after a timeout or 5xx we NEVER resend; we mark the row `unknown` and reconcile.

import { v } from "convex/values";

import { DAY_MS, loadConfig } from "../lib/config";
import { formatFCFA } from "../lib/money";
import { getPaymentProvider } from "../lib/providers";
import { PaymentProviderError, type PayoutListItem } from "../lib/providers/types";
import { fr } from "../lib/strings.fr";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { notifyUser } from "./notify";
import { methodV, payoutKindV, payoutStatusV } from "./validators";

/** Most payouts to drain in a single cron tick, to stay well under NabooPay's rate limit. */
const DRAIN_BATCH = 10;
/** Retries (409 or a reconciled-not-found requeue) before a payout is failed for manual handling. */
const MAX_PAYOUT_ATTEMPTS = 5;
/** How far back `listPayouts` looks when reconciling, to catch a payout created just before a timeout. */
const RECONCILE_WINDOW_MS = 10 * 60 * 1000;
/** Throttle on the short-balance moderator alert, so a persistently low balance does not spam it. */
const BALANCE_ALERT_THROTTLE_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Enqueue (called directly, in the caller's transaction, by releaseCause / decide* mutations)
// ---------------------------------------------------------------------------

export interface EnqueueArgs {
  kind: Doc<"payouts">["kind"];
  /** Cause id (release / deletion payout) or donation id (refund). */
  targetId: string;
  amount: number;
  method: Doc<"payouts">["method"];
  phone: string;
  name: string;
}

/**
 * Inserts a `queued` payout. Call this from within a mutation (same transaction as the state change
 * that triggers the payout) so enqueuing is atomic with it.
 */
export async function enqueuePayout(ctx: MutationCtx, args: EnqueueArgs): Promise<Id<"payouts">> {
  const payoutId = await ctx.db.insert("payouts", {
    ...args,
    status: "queued",
    attempts: 0,
    createdAt: Date.now(),
  });
  await logAudit(ctx, {
    action: "payout.enqueue",
    targetTable: "payouts",
    targetId: payoutId,
    details: { kind: args.kind, amount: args.amount, target: args.targetId },
  });
  return payoutId;
}

/**
 * Whether a donation's net belongs in a release to its structure: still held, not flagged for a
 * late refund, and no refund payout queued for it. Every release sum and completion goes through it,
 * so a donation being refunded can never also be paid to the structure.
 */
export function isReleasable(donation: Doc<"donations">): boolean {
  return (
    donation.status === "held" &&
    donation.lateRefundFlaggedAt === undefined &&
    donation.refundQueuedAt === undefined
  );
}

/**
 * Queues a refund payout of a donation's net to `to` and marks the donation `refundQueuedAt`, in the
 * caller's transaction, so no release can include it while the refund is in flight.
 */
export async function enqueueDonationRefund(
  ctx: MutationCtx,
  donation: Doc<"donations">,
  to: { phone: string; name: string },
): Promise<Id<"payouts">> {
  const payoutId = await enqueuePayout(ctx, {
    kind: "refund",
    targetId: donation._id,
    amount: donation.net,
    method: donation.paidMethod ?? donation.method,
    phone: to.phone,
    name: to.name,
  });
  await ctx.db.patch(donation._id, { refundQueuedAt: Date.now() });
  return payoutId;
}

/** Thin internal wrapper around `enqueuePayout`, for callers that are not already in a mutation. */
export const enqueue = internalMutation({
  args: {
    kind: payoutKindV,
    targetId: v.string(),
    amount: v.number(),
    method: methodV,
    phone: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ payoutId: Id<"payouts"> }> => {
    return { payoutId: await enqueuePayout(ctx, args) };
  },
});

// ---------------------------------------------------------------------------
// Completion handlers (run inside the mutation that marks a payout completed)
// ---------------------------------------------------------------------------

async function structureUser(
  ctx: MutationCtx,
  structureId: Id<"structures">,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_structure", (q) => q.eq("structureId", structureId))
    .first();
}

/** A release / deletion payout reached the structure: free the donations and open the proof deadline. */
async function completeRelease(ctx: MutationCtx, payout: Doc<"payouts">): Promise<void> {
  const causeId = ctx.db.normalizeId("causes", payout.targetId);
  if (!causeId) {
    console.error(`release payout ${payout._id} has a non-cause targetId ${payout.targetId}`);
    return;
  }
  const cause = await ctx.db.get(causeId);
  if (!cause) return;

  const donations = await ctx.db
    .query("donations")
    .withIndex("by_cause", (q) => q.eq("causeId", causeId))
    .collect();
  for (const d of donations) {
    // Late-flagged or refund-queued donations go back to the donor, not to the structure: leave
    // them `held` for their refund (they were also excluded from the payout amount).
    if (isReleasable(d)) {
      await ctx.db.patch(d._id, { status: "released" });
    }
  }

  // Proof deadline (DT-25): one per cause, due PROOF_DUE_DAYS after funds reach the structure.
  const existing = await ctx.db
    .query("proofDeadlines")
    .withIndex("by_cause", (q) => q.eq("causeId", causeId))
    .unique();
  const { proofDueDays } = loadConfig(process.env);
  if (!existing) {
    await ctx.db.insert("proofDeadlines", {
      causeId,
      structureId: cause.structureId,
      reason: cause.status === "deleted" ? "deletion_payout" : "release",
      dueAt: Date.now() + proofDueDays * DAY_MS,
      enforced: true,
    });
  }
  await logAudit(ctx, {
    action: "funds.release",
    targetTable: "causes",
    targetId: causeId,
    details: {
      payoutId: payout._id,
      amount: payout.amount,
      orderId: payout.providerOrderId ?? null,
    },
  });
  const responsible = await structureUser(ctx, cause.structureId);
  if (responsible) {
    await notifyUser(ctx, {
      userId: responsible._id,
      kind: "funds_released",
      title: fr.notifications.fundsReleasedTitle,
      body: fr.notifications.fundsReleasedBody(
        cause.title,
        formatFCFA(payout.amount),
        proofDueDays,
      ),
      link: "/structure",
    });
  }
}

/** A refund payout reached the donor: mark the donation refunded and close its request, if any. */
async function completeRefund(ctx: MutationCtx, payout: Doc<"payouts">): Promise<void> {
  const donationId = ctx.db.normalizeId("donations", payout.targetId);
  if (!donationId) {
    console.error(`refund payout ${payout._id} has a non-donation targetId ${payout.targetId}`);
    return;
  }
  const donation = await ctx.db.get(donationId);
  if (!donation) return;
  if (donation.status !== "refunded") await ctx.db.patch(donationId, { status: "refunded" });
  const request = await ctx.db
    .query("refundRequests")
    .withIndex("by_donation", (q) => q.eq("donationId", donationId))
    .unique();
  if (request && request.status !== "refunded") {
    await ctx.db.patch(request._id, {
      status: "refunded",
      refundAmount: payout.amount,
      payoutId: payout._id,
    });
  }
  await logAudit(ctx, {
    action: "funds.refund",
    targetTable: "donations",
    targetId: donationId,
    details: {
      payoutId: payout._id,
      amount: payout.amount,
      orderId: payout.providerOrderId ?? null,
    },
  });
}

async function runCompletion(ctx: MutationCtx, payout: Doc<"payouts">): Promise<void> {
  if (payout.kind === "release") await completeRelease(ctx, payout);
  else await completeRefund(ctx, payout);
}

// ---------------------------------------------------------------------------
// Moderator alerting (short balance, failed payout)
// ---------------------------------------------------------------------------

export async function alertModerators(ctx: MutationCtx, detail: string): Promise<void> {
  const moderators = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "moderator"))
    .collect();
  for (const m of moderators) {
    await notifyUser(ctx, {
      userId: m._id,
      kind: "payout_alert",
      title: fr.notifications.payoutAlertTitle,
      body: fr.notifications.payoutAlertBody(detail),
      link: "/file",
    });
  }
}

// ---------------------------------------------------------------------------
// Claim + outcome mutations (each leaves the row in a non-`sending` state)
// ---------------------------------------------------------------------------

export type ClaimedPayout = {
  payoutId: Id<"payouts">;
  kind: Doc<"payouts">["kind"];
  amount: number;
  method: Doc<"payouts">["method"];
  phone: string;
  name: string;
};

/**
 * Single-flight claim: nothing while a payout is `sending`, else the oldest `queued` → `sending`.
 * `exclude` holds payouts already skipped this tick (e.g. under-funded), so the worker can reach
 * smaller payouts behind them instead of re-claiming the same head row every time.
 */
export const claimNext = internalMutation({
  args: { exclude: v.optional(v.array(v.id("payouts"))) },
  handler: async (ctx, { exclude }): Promise<ClaimedPayout | null> => {
    const sending = await ctx.db
      .query("payouts")
      .withIndex("by_status_created", (q) => q.eq("status", "sending"))
      .first();
    if (sending) return null;
    const skip = new Set(exclude ?? []);
    const queued = await ctx.db
      .query("payouts")
      .withIndex("by_status_created", (q) => q.eq("status", "queued"))
      .take(DRAIN_BATCH + skip.size);
    const next = queued.find((p) => !skip.has(p._id));
    if (!next) return null;
    await ctx.db.patch(next._id, { status: "sending" });
    return {
      payoutId: next._id,
      kind: next.kind,
      amount: next.amount,
      method: next.method,
      phone: next.phone,
      name: next.name,
    };
  },
});

export const payoutCompleted = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    providerOrderId: v.string(),
    reviewPending: v.boolean(),
  },
  handler: async (ctx, { payoutId, providerOrderId, reviewPending }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.status === "completed") return;
    if (reviewPending) {
      await ctx.db.patch(payoutId, { status: "pending_review", providerOrderId });
      await logAudit(ctx, {
        action: "payout.pending_review",
        targetTable: "payouts",
        targetId: payoutId,
        details: { orderId: providerOrderId },
      });
      return;
    }
    await ctx.db.patch(payoutId, { status: "completed", providerOrderId, completedAt: Date.now() });
    await runCompletion(ctx, { ...payout, status: "completed", providerOrderId });
    await logAudit(ctx, {
      action: "payout.completed",
      targetTable: "payouts",
      targetId: payoutId,
      details: { kind: payout.kind, amount: payout.amount, orderId: providerOrderId },
    });
  },
});

/** `409`: another payout is running. Requeue to retry, counting the attempt; give up after the cap. */
export const payoutConflict = internalMutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.status !== "sending") return;
    const attempts = payout.attempts + 1;
    if (attempts > MAX_PAYOUT_ATTEMPTS) {
      await ctx.db.patch(payoutId, { status: "failed", attempts, error: "too many 409 retries" });
      await logAudit(ctx, {
        action: "payout.failed",
        targetTable: "payouts",
        targetId: payoutId,
        details: { reason: "max_attempts" },
      });
      await alertModerators(ctx, fr.notifications.payoutBlockedDetail(payoutId, attempts));
      return;
    }
    await ctx.db.patch(payoutId, { status: "queued", attempts });
  },
});

/**
 * Balance too low for this payout: leave the row `queued` (no attempt counted) and record it. The
 * worker skips it and tries smaller payouts behind it; the moderator alert is raised once per tick
 * by `alertShortBalance`, not here, so a persistently short balance does not spam every moderator.
 */
export const payoutInsufficientBalance = internalMutation({
  args: { payoutId: v.id("payouts"), balance: v.number() },
  handler: async (ctx, { payoutId, balance }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.status !== "sending") return;
    await ctx.db.patch(payoutId, { status: "queued" });
    await logAudit(ctx, {
      action: "payout.insufficient_balance",
      targetTable: "payouts",
      targetId: payoutId,
      details: { amount: payout.amount, balance },
    });
  },
});

/** Alert moderators that the balance is short, at most once per `BALANCE_ALERT_THROTTLE_MS`. */
export const alertShortBalance = internalMutation({
  args: { count: v.number(), balance: v.number() },
  handler: async (ctx, { count, balance }) => {
    const last = await ctx.db
      .query("auditLog")
      .withIndex("by_action_created", (q) => q.eq("action", "payout.short_balance_alert"))
      .order("desc")
      .first();
    if (last && Date.now() - last.createdAt < BALANCE_ALERT_THROTTLE_MS) return;
    await logAudit(ctx, {
      action: "payout.short_balance_alert",
      targetTable: "payouts",
      targetId: "worker",
      details: { count, balance },
    });
    await alertModerators(ctx, fr.notifications.payoutBalanceLowDetail(formatFCFA(balance), count));
  },
});

/** A transient read error (e.g. the balance check failed): requeue without counting an attempt. */
export const requeuePayout = internalMutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const payout = await ctx.db.get(payoutId);
    if (payout?.status === "sending") await ctx.db.patch(payoutId, { status: "queued" });
  },
});

/** Timeout or 5xx: the outcome is unknown. NEVER resend — reconcile against NabooPay instead. */
export const payoutUnknown = internalMutation({
  args: { payoutId: v.id("payouts"), error: v.string() },
  handler: async (ctx, { payoutId, error }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.status !== "sending") return;
    await ctx.db.patch(payoutId, { status: "unknown", error });
    await logAudit(ctx, {
      action: "payout.unknown",
      targetTable: "payouts",
      targetId: payoutId,
      details: { error },
    });
  },
});

/** A terminal 4xx (invalid request, payout not enabled, …): fail and alert for manual handling. */
export const payoutFailed = internalMutation({
  args: { payoutId: v.id("payouts"), error: v.string() },
  handler: async (ctx, { payoutId, error }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || (payout.status !== "sending" && payout.status !== "pending_review")) return;
    await ctx.db.patch(payoutId, { status: "failed", error });
    await logAudit(ctx, {
      action: "payout.failed",
      targetTable: "payouts",
      targetId: payoutId,
      details: { error },
    });
    await alertModerators(ctx, fr.notifications.payoutFailedDetail(payoutId, error));
  },
});

// Reconciliation — resolve an `unknown` row from NabooPay, or requeue it if nothing was created.

export const payoutById = internalQuery({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => ctx.db.get(payoutId),
});

/** Whether some payout row already carries this NabooPay order id (so it is accounted for). */
export const isOrderClaimed = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }): Promise<boolean> => {
    const row = await ctx.db
      .query("payouts")
      .withIndex("by_order", (q) => q.eq("providerOrderId", orderId))
      .first();
    return row !== null;
  },
});

/** After `unknown`, requeue because `listPayouts` confirmed NabooPay created nothing — safe to retry. */
export const requeueFromUnknown = internalMutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.status !== "unknown") return;
    const attempts = payout.attempts + 1;
    if (attempts > MAX_PAYOUT_ATTEMPTS) {
      await ctx.db.patch(payoutId, {
        status: "failed",
        attempts,
        error: "unresolved after reconcile",
      });
      await alertModerators(ctx, fr.notifications.payoutUnresolvedDetail(payoutId));
      return;
    }
    await ctx.db.patch(payoutId, { status: "queued", attempts });
  },
});

export const reconcile = internalAction({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }): Promise<{ status: string }> => {
    const payout = await ctx.runQuery(internal.payouts.payoutById, { payoutId });
    if (!payout || payout.status !== "unknown") return { status: payout?.status ?? "missing" };
    const provider = getPaymentProvider();
    let items;
    try {
      items = await provider.listPayouts({
        recipientPhone: payout.phone,
        since: payout.createdAt - RECONCILE_WINDOW_MS,
      });
    } catch (error) {
      console.error(`reconcile ${payoutId} could not list payouts: ${String(error)}`);
      return { status: "unknown" };
    }
    // Match on amount, but skip any item already recorded on another payout row: a same-amount
    // payout to the same wallet inside the window belongs to a different (already-accounted) row,
    // and must not be mistaken for this one.
    let match: PayoutListItem | undefined;
    for (const item of items) {
      if (item.amount !== payout.amount) continue;
      const claimed = await ctx.runQuery(internal.payouts.isOrderClaimed, {
        orderId: item.orderId,
      });
      if (!claimed) {
        match = item;
        break;
      }
    }
    if (!match) {
      // NabooPay created nothing we can claim: the request never landed. Safe to retry.
      await ctx.runMutation(internal.payouts.requeueFromUnknown, { payoutId });
      return { status: "queued" };
    }
    if (match.status === "completed") {
      await ctx.runMutation(internal.payouts.payoutCompleted, {
        payoutId,
        providerOrderId: match.orderId,
        reviewPending: false,
      });
      return { status: "completed" };
    }
    if (match.status === "pending") {
      // NabooPay has it but it is not final: move it to `pending_review` (recording the order id)
      // so pollPendingReview owns it from here, instead of leaving the row stuck in `unknown`.
      await ctx.runMutation(internal.payouts.payoutCompleted, {
        payoutId,
        providerOrderId: match.orderId,
        reviewPending: true,
      });
      return { status: "pending_review" };
    }
    await ctx.runMutation(internal.payouts.payoutFailed, {
      payoutId,
      error: `reconciled as ${match.status}`,
    });
    return { status: "failed" };
  },
});

// ---------------------------------------------------------------------------
// The worker (cron) — drains `queued` payouts one at a time
// ---------------------------------------------------------------------------

function payoutReason(kind: Doc<"payouts">["kind"]): string {
  return kind === "release" ? "SUNUSOCIAL versement cause" : "SUNUSOCIAL remboursement";
}

export const drainNext = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const provider = getPaymentProvider();
    let processed = 0;
    // Payouts skipped this tick for lack of balance; excluded from the next claim so the worker
    // reaches smaller payouts behind them instead of re-claiming the same under-funded head row.
    const short: Id<"payouts">[] = [];
    let lastShortBalance = 0;
    for (let i = 0; i < DRAIN_BATCH; i++) {
      const claimed = await ctx.runMutation(internal.payouts.claimNext, { exclude: short });
      if (!claimed) break; // nothing claimable (queue empty, all skipped, or one already sending)

      let balance: number;
      try {
        balance = await provider.getBalance();
      } catch (error) {
        await ctx.runMutation(internal.payouts.requeuePayout, { payoutId: claimed.payoutId });
        console.error(`payout balance check failed: ${String(error)}`);
        break;
      }
      if (balance < claimed.amount) {
        await ctx.runMutation(internal.payouts.payoutInsufficientBalance, {
          payoutId: claimed.payoutId,
          balance,
        });
        short.push(claimed.payoutId);
        lastShortBalance = balance;
        continue; // try a smaller payout behind it rather than blocking the whole queue
      }

      try {
        const res = await provider.payout({
          method: claimed.method,
          amount: claimed.amount,
          phone: claimed.phone,
          name: claimed.name,
          reason: payoutReason(claimed.kind),
        });
        if (res.status === "failed") {
          await ctx.runMutation(internal.payouts.payoutFailed, {
            payoutId: claimed.payoutId,
            error: "provider reported failed",
          });
          continue;
        }
        await ctx.runMutation(internal.payouts.payoutCompleted, {
          payoutId: claimed.payoutId,
          providerOrderId: res.orderId,
          reviewPending: res.status === "pending",
        });
        processed += 1;
      } catch (error) {
        const status = error instanceof PaymentProviderError ? error.status : undefined;
        if (status === 409) {
          await ctx.runMutation(internal.payouts.payoutConflict, { payoutId: claimed.payoutId });
          break; // respect the per-org lock; resume next tick
        }
        if (status === undefined || status >= 500) {
          await ctx.runMutation(internal.payouts.payoutUnknown, {
            payoutId: claimed.payoutId,
            error: String(error),
          });
          await ctx.scheduler.runAfter(0, internal.payouts.reconcile, {
            payoutId: claimed.payoutId,
          });
          break; // stop until reconciliation resolves it
        }
        await ctx.runMutation(internal.payouts.payoutFailed, {
          payoutId: claimed.payoutId,
          error: String(error),
        });
      }
    }
    if (short.length > 0) {
      await ctx.runMutation(internal.payouts.alertShortBalance, {
        count: short.length,
        balance: lastShortBalance,
      });
    }
    return { processed };
  },
});

// ---------------------------------------------------------------------------
// Pending-review polling + unknown reconciliation (crons)
// ---------------------------------------------------------------------------

export const payoutsByStatus = internalQuery({
  args: { status: payoutStatusV },
  handler: async (ctx, { status }) => {
    return await ctx.db
      .query("payouts")
      .withIndex("by_status_created", (q) => q.eq("status", status))
      .take(DRAIN_BATCH);
  },
});

/** Poll NabooPay for payouts stuck in manual review (> 2,000,000 XOF). */
export const pollPendingReview = internalAction({
  args: {},
  handler: async (ctx): Promise<{ polled: number }> => {
    const rows = await ctx.runQuery(internal.payouts.payoutsByStatus, { status: "pending_review" });
    const provider = getPaymentProvider();
    for (const row of rows) {
      if (!row.providerOrderId) continue;
      try {
        const info = await provider.getPayout(row.providerOrderId);
        if (info.status === "completed") {
          await ctx.runMutation(internal.payouts.payoutCompleted, {
            payoutId: row._id,
            providerOrderId: row.providerOrderId,
            reviewPending: false,
          });
        } else if (info.status === "failed" || info.status === "cancelled") {
          await ctx.runMutation(internal.payouts.payoutFailed, {
            payoutId: row._id,
            error: `review resolved as ${info.status}`,
          });
        }
      } catch (error) {
        console.warn(`poll pending_review ${row._id} failed: ${String(error)}`);
      }
    }
    return { polled: rows.length };
  },
});

/** Safety net: reconcile any `unknown` rows whose inline reconciliation did not run or finish. */
export const reconcileUnknown = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scheduled: number }> => {
    const rows = await ctx.runQuery(internal.payouts.payoutsByStatus, { status: "unknown" });
    for (const row of rows) {
      await ctx.scheduler.runAfter(0, internal.payouts.reconcile, { payoutId: row._id });
    }
    return { scheduled: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Daily ledger check (monitoring, DT-4 "every outcome audited")
// ---------------------------------------------------------------------------

export const heldNetTotal = internalQuery({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Scan is bounded in practice by the held-donations volume; a dedicated aggregate can replace it.
    const held = await ctx.db
      .query("donations")
      .withIndex("by_status_created", (q) => q.eq("status", "held"))
      .collect();
    return held.reduce((sum, d) => sum + d.net, 0);
  },
});

export const dailyLedgerCheck = internalAction({
  args: {},
  handler: async (ctx): Promise<{ drift: number }> => {
    const provider = getPaymentProvider();
    const owed = await ctx.runQuery(internal.payouts.heldNetTotal, {});
    let balance: number;
    try {
      balance = await provider.getBalance();
    } catch (error) {
      console.error(`ledger check could not read balance: ${String(error)}`);
      return { drift: 0 };
    }
    // The main balance should cover at least what we still owe as net to structures/donors.
    const drift = balance - owed;
    await ctx.runMutation(internal.payouts.recordLedgerCheck, { owed, balance, drift });
    return { drift };
  },
});

export const recordLedgerCheck = internalMutation({
  args: { owed: v.number(), balance: v.number(), drift: v.number() },
  handler: async (ctx, details) => {
    await logAudit(ctx, {
      action: "ledger.check",
      targetTable: "payouts",
      targetId: "ledger",
      details,
    });
    if (details.drift < 0) {
      await alertModerators(
        ctx,
        fr.notifications.payoutBalanceDriftDetail(formatFCFA(details.balance)),
      );
    }
  },
});
