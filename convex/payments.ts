// Confirming payments and the money side of a cause (DT-3, DT-6, DT-24, DB-18). The webhook and
// the status-check fallback both land in `recordPayment`, which is idempotent on the order_id and
// is the only place a donation becomes `held`. Releases and payouts arrive with the worker (Sprint 6).

import { v } from "convex/values";

import { loadConfig } from "../lib/config";
import { computeFee, formatFCFA, settle } from "../lib/money";
import { getMockProvider, getPaymentProvider } from "../lib/providers";
import { isPaidStatus, parseWebhookPayload } from "../lib/providers/types";
import { fr } from "../lib/strings.fr";
import type { Method } from "../lib/types";
import { errorPath, successPath } from "./donations";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { notifyUser } from "./notify";
import { methodV } from "./validators";

/** A pending payment is re-checked against NabooPay after this long (webhooks are success-only). */
export const RECHECK_AFTER_MS = 5 * 60 * 1000;
/** An unpaid transaction is cancelled and the donation failed after this long (DT-3). */
export const CANCEL_AFTER_MS = 2 * 60 * 60 * 1000;
/** NabooPay allows 100 requests / 60 s per endpoint; stay well under it each cron run. */
export const RECHECK_BATCH = 50;

type RecordOutcome = "counted" | "late" | "duplicate" | "unknown_order" | "mismatch";

// ---------------------------------------------------------------------------
// Recording a confirmed payment
// ---------------------------------------------------------------------------

/** True once this donor has another confirmed gift to the cause (so `donorCount` must not move). */
async function donorAlreadyGave(ctx: MutationCtx, donation: Doc<"donations">): Promise<boolean> {
  const siblings = await ctx.db
    .query("donations")
    .withIndex("by_cause_donor", (q) =>
      q.eq("causeId", donation.causeId).eq("donorId", donation.donorId),
    )
    .collect();
  return siblings.some(
    (d) => d._id !== donation._id && (d.status === "held" || d.status === "released"),
  );
}

/**
 * Records a confirmed NabooPay payment. Idempotent on the order_id: a second delivery of an
 * already-paid donation is a no-op. Stores NabooPay's actual fee; counts the donation toward its
 * cause only while the cause is still `active`, otherwise flags it for an automatic refund (DB-18).
 */
export const recordPayment = internalMutation({
  args: {
    orderId: v.string(),
    amount: v.number(),
    fees: v.number(),
    method: v.optional(methodV),
  },
  handler: async (ctx, { orderId, amount, fees, method }): Promise<{ outcome: RecordOutcome }> => {
    const donation = await ctx.db
      .query("donations")
      .withIndex("by_txn", (q) => q.eq("providerTxnId", orderId))
      .unique();
    if (!donation) {
      console.warn(`webhook for unknown order_id ${orderId}`);
      return { outcome: "unknown_order" };
    }
    // Already recorded (duplicate delivery). `pending` and `failed` are both recordable: a payment
    // can arrive after we cancelled an abandoned transaction — the money was still received.
    if (
      donation.status === "held" ||
      donation.status === "released" ||
      donation.status === "refunded"
    ) {
      return { outcome: "duplicate" };
    }
    if (amount !== donation.amount) {
      await logAudit(ctx, {
        action: "donation.amount_mismatch",
        targetTable: "donations",
        targetId: donation._id,
        details: { orderId, expected: donation.amount, received: amount },
      });
      console.error(`amount mismatch for ${orderId}: expected ${donation.amount}, got ${amount}`);
      return { outcome: "mismatch" };
    }

    const platformFeeRate = loadConfig(process.env).platformFeeRate;
    const settled = settle(amount, fees, platformFeeRate);
    if (settled.fee !== donation.fee) {
      // The 3% was an estimate; NabooPay's actual fee is authoritative (DT-6).
      await logAudit(ctx, {
        action: "donation.fee_adjusted",
        targetTable: "donations",
        targetId: donation._id,
        details: { orderId, estimated: donation.fee, actual: settled.fee },
      });
    }
    await ctx.db.patch(donation._id, {
      fee: settled.fee,
      platformFee: settled.platformFee,
      net: settled.net,
      paidMethod: method ?? donation.method,
      status: "held",
    });
    await logAudit(ctx, {
      actorId: donation.donorId,
      action: "donation.paid",
      targetTable: "donations",
      targetId: donation._id,
      details: { orderId, amount, fee: settled.fee, net: settled.net },
    });

    const cause = await ctx.db.get(donation.causeId);
    const now = Date.now();

    // Late payment (DB-18): the cause is no longer active. Keep it `held`; the payout worker
    // (Sprint 6) refunds its net automatically. Do not count it toward the cause.
    if (!cause || cause.status !== "active") {
      await ctx.db.patch(donation._id, { lateRefundFlaggedAt: now });
      await logAudit(ctx, {
        action: "donation.late_refund_flagged",
        targetTable: "donations",
        targetId: donation._id,
        details: { orderId, causeStatus: cause?.status ?? "missing" },
      });
      const title = cause?.title ?? "";
      await notifyUser(ctx, {
        userId: donation.donorId,
        kind: "donation_late_refund",
        title: fr.notifications.lateRefundTitle,
        body: fr.notifications.lateRefundBody(
          formatFCFA(donation.amount),
          formatFCFA(settled.net),
          title,
        ),
        link: "/profil",
        sms: fr.sms.lateRefund(title, formatFCFA(settled.net)),
      });
      return { outcome: "late" };
    }

    // Counted toward the cause.
    const firstGift = !(await donorAlreadyGave(ctx, donation));
    const raised = cause.raised + amount;
    const patch: Partial<Doc<"causes">> = {
      raised,
      donorCount: cause.donorCount + (firstGift ? 1 : 0),
    };
    // A goal cause that reaches its goal closes in full, even over the goal (PARCOURS S21, DT-24).
    // The release payout itself is queued by the worker in Sprint 6.
    if (cause.endType === "goal" && raised >= cause.goalAmount) {
      patch.status = "closed";
      patch.closedAt = now;
    }
    await ctx.db.patch(cause._id, patch);
    if (patch.status === "closed") {
      await logAudit(ctx, {
        action: "cause.closed_goal",
        targetTable: "causes",
        targetId: cause._id,
        details: { raised, goal: cause.goalAmount },
      });
    }
    await notifyUser(ctx, {
      userId: donation.donorId,
      kind: "donation_confirmed",
      title: fr.notifications.donationConfirmedTitle,
      body: fr.notifications.donationConfirmedBody(formatFCFA(donation.amount), cause.title),
      link: "/profil",
    });
    return { outcome: "counted" };
  },
});

// ---------------------------------------------------------------------------
// Webhook (shared by the HTTP endpoint and the mock simulator)
// ---------------------------------------------------------------------------

/**
 * Verifies and records a webhook body. Shared so the mock simulator exercises the exact same
 * signature check and recording path as a real NabooPay call. Returns the HTTP status to answer.
 */
export async function handleWebhook(
  ctx: ActionCtx,
  rawBody: string,
  signature: string | null,
): Promise<number> {
  const provider = getPaymentProvider();
  if (!(await provider.verifyWebhook(rawBody, signature))) return 401;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return 400;
  }
  const payload = parseWebhookPayload(parsed);
  if (!payload) return 400;
  // Only paid events matter; acknowledge the rest so NabooPay stops retrying them.
  if (!isPaidStatus(payload.status)) return 200;

  let fees = payload.fees;
  let method: Method | undefined = payload.method;
  if (fees === undefined) {
    // Legacy v1 payload: the fee isn't in the body. Read it from NabooPay.
    try {
      const transaction = await provider.getTransaction(payload.orderId);
      fees = transaction.fees;
      method = method ?? transaction.method;
    } catch (error) {
      console.error(`could not fetch fees for ${payload.orderId}: ${String(error)}`);
      return 503; // NabooPay retries; the cron also catches it.
    }
    if (fees === undefined) return 503;
  }
  await ctx.runMutation(internal.payments.recordPayment, {
    orderId: payload.orderId,
    amount: payload.amount,
    fees,
    method,
  });
  return 200;
}

// ---------------------------------------------------------------------------
// Pending re-check and cancellation (cron, DT-3)
// ---------------------------------------------------------------------------

export const pendingToCheck = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<{ orderId: string | null; createdAt: number }>> => {
    const now = Date.now();
    const pending = await ctx.db
      .query("donations")
      .withIndex("by_status_created", (q) =>
        q.eq("status", "pending").lt("createdAt", now - RECHECK_AFTER_MS),
      )
      .take(RECHECK_BATCH);
    return pending.map((d) => ({ orderId: d.providerTxnId ?? null, createdAt: d.createdAt }));
  },
});

/** Marks a still-pending donation `failed` (abandoned, or NabooPay cancelled). */
export const cancelPending = internalMutation({
  args: { orderId: v.string(), reason: v.string() },
  handler: async (ctx, { orderId, reason }) => {
    const donation = await ctx.db
      .query("donations")
      .withIndex("by_txn", (q) => q.eq("providerTxnId", orderId))
      .unique();
    if (!donation || donation.status !== "pending") return;
    await ctx.db.patch(donation._id, { status: "failed" });
    await logAudit(ctx, {
      actorId: donation.donorId,
      action: "donation.cancelled",
      targetTable: "donations",
      targetId: donation._id,
      details: { orderId, reason },
    });
  },
});

/** Re-checks pending payments against NabooPay and cancels those abandoned for over 2 hours. */
export const recheckPending = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; paid: number; failed: number }> => {
    const pending = await ctx.runQuery(internal.payments.pendingToCheck, {});
    const provider = getPaymentProvider();
    const now = Date.now();
    let paid = 0;
    let failed = 0;
    for (const { orderId, createdAt } of pending) {
      const old = now - createdAt >= CANCEL_AFTER_MS;
      if (!orderId) {
        // Checkout never returned an order_id; nothing to cancel at NabooPay.
        if (old) failed += 1;
        continue;
      }
      try {
        const transaction = await provider.getTransaction(orderId);
        if (isPaidStatus(transaction.status) && transaction.fees !== undefined) {
          await ctx.runMutation(internal.payments.recordPayment, {
            orderId,
            amount: transaction.amount,
            fees: transaction.fees,
            method: transaction.method,
          });
          paid += 1;
          continue;
        }
        if (old) {
          await provider.cancelTransaction(orderId);
          await ctx.runMutation(internal.payments.cancelPending, { orderId, reason: "abandoned" });
          failed += 1;
        }
      } catch (error) {
        console.warn(`recheck failed for ${orderId}: ${String(error)}`);
      }
    }
    return { checked: pending.length, paid, failed };
  },
});

// ---------------------------------------------------------------------------
// Mock simulator (development / preview only)
// ---------------------------------------------------------------------------

export const simTarget = internalQuery({
  args: { donationId: v.string() },
  handler: async (
    ctx,
    { donationId },
  ): Promise<
    { ok: true; orderId: string; amount: number; method: Method; causeId: string } | { ok: false }
  > => {
    const { user } = await requireRole(ctx, "donor");
    const id = ctx.db.normalizeId("donations", donationId);
    const donation = id && (await ctx.db.get(id));
    if (!donation || donation.donorId !== user._id) return { ok: false };
    if (donation.status !== "pending" || !donation.providerTxnId) return { ok: false };
    return {
      ok: true,
      orderId: donation.providerTxnId,
      amount: donation.amount,
      method: donation.method,
      causeId: donation.causeId,
    };
  },
});

/**
 * Drives the mock checkout page's buttons. Refused unless `PAYMENT_PROVIDER=mock` outside
 * production, and only on the donor's own pending donation. `paid` signs a webhook body with the
 * mock secret and runs it through `handleWebhook`, so the real recording path is exercised.
 */
export const simulatePayment = action({
  args: { donationId: v.string(), outcome: v.union(v.literal("paid"), v.literal("cancelled")) },
  handler: async (ctx, { donationId, outcome }): Promise<{ redirectTo: string }> => {
    const mock = getMockProvider();
    if (!mock) throw appError("FORBIDDEN", fr.errors.simulatorOff);
    const target = await ctx.runQuery(internal.payments.simTarget, { donationId });
    if (!target.ok) throw appError("NOT_FOUND", fr.errors.donationNotFound);

    if (outcome === "cancelled") {
      await ctx.runMutation(internal.payments.cancelPending, {
        orderId: target.orderId,
        reason: "simulator_cancelled",
      });
      return { redirectTo: errorPath(target.causeId) };
    }

    const fee = computeFee(target.amount, "mock").fee;
    const body = JSON.stringify({
      order_id: target.orderId,
      amount: target.amount,
      fees: fee,
      transaction_status: "paid",
      selected_payment_method: target.method,
      currency: "XOF",
    });
    const status = await handleWebhook(ctx, body, await mock.sign(body));
    if (status !== 200) throw appError("PAYMENT_FAILED", fr.errors.paymentUnavailable);
    return { redirectTo: successPath(donationId) };
  },
});
