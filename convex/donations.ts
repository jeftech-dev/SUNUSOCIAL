// Donations: checkout, the donor's live status and history (DT-3, DT-6). Spec: docs/API_CONTRACT.md
// "Donations". Payments are confirmed in convex/payments.ts, never from the client.

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { percentOf } from "../lib/causes";
import { loadConfig } from "../lib/config";
import { computeFee, formatFCFA, isValidDonationAmount } from "../lib/money";
import { getPaymentProvider, siteUrl } from "../lib/providers";
import { isPaidStatus, splitFullName } from "../lib/providers/types";
import { fr } from "../lib/strings.fr";
import type {
  DonationHistoryView,
  DonationStatus,
  DonationStatusView,
  DonorImpact,
  FeeBreakdown,
} from "../lib/types";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { isListed } from "./lib/causeViews";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { hitRateLimit } from "./lib/rateLimit";
import { methodV } from "./validators";

/** Checkouts per donor per window (DT-19): enough to retry, not to flood NabooPay. */
export const CHECKOUT_MAX = 10;
export const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
/** NabooPay status checks a donor can trigger from the success page per window. */
export const REFRESH_MAX = 20;
export const REFRESH_WINDOW_MS = 10 * 60 * 1000;
/** Largest history page a client may ask for. */
export const MAX_PAGE_SIZE = 50;
/** Donations read to compute a donor's impact. */
const IMPACT_SCAN = 2000;

/** NabooPay's return URLs: plain paths built from our own ids (no percent-encoding, DT-3). */
export function successPath(donationId: string): string {
  return `/dons/${donationId}`;
}
export function errorPath(causeId: string): string {
  return `/causes/${causeId}?paiement=echec`;
}

/** The donation of `donationId` if it belongs to `userId`, else null (malformed ids included). */
async function ownDonation(
  ctx: QueryCtx,
  userId: Id<"users">,
  donationId: string,
): Promise<Doc<"donations"> | null> {
  const id = ctx.db.normalizeId("donations", donationId);
  const donation = id && (await ctx.db.get(id));
  return donation && donation.donorId === userId ? donation : null;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type CheckoutResponse = FeeBreakdown & {
  donationId: Id<"donations">;
  checkoutUrl: string;
  status: "pending";
};

/**
 * Starts a donation: inserts it `pending` with the server-side fee estimate, creates the NabooPay
 * transaction, and stores its `order_id` before answering (the client then redirects).
 */
export const createCheckout = action({
  args: { causeId: v.string(), amount: v.number(), method: methodV },
  handler: async (ctx, args): Promise<CheckoutResponse> => {
    const prepared = await ctx.runMutation(internal.donations.prepareCheckout, args);
    const base = siteUrl();
    let checkout: { checkoutUrl: string; providerTxnId: string };
    try {
      checkout = await getPaymentProvider().createCheckout({
        donationId: prepared.donationId,
        amount: prepared.breakdown.amount,
        method: args.method,
        causeTitle: prepared.causeTitle,
        customer: prepared.customer,
        successUrl: `${base}${successPath(prepared.donationId)}`,
        errorUrl: `${base}${errorPath(prepared.causeId)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`checkout failed for donation ${prepared.donationId}: ${message}`);
      await ctx.runMutation(internal.donations.markCheckoutFailed, {
        donationId: prepared.donationId,
        error: message.slice(0, 500),
      });
      throw appError("PAYMENT_FAILED", fr.errors.paymentUnavailable);
    }
    await ctx.runMutation(internal.donations.attachOrder, {
      donationId: prepared.donationId,
      providerTxnId: checkout.providerTxnId,
    });
    return {
      ...prepared.breakdown,
      donationId: prepared.donationId,
      checkoutUrl: checkout.checkoutUrl,
      status: "pending",
    };
  },
});

/** Checks the donor, the cause (DT-34, DB-17), the amount and the rate limit; inserts the donation. */
export const prepareCheckout = internalMutation({
  args: { causeId: v.string(), amount: v.number(), method: methodV },
  handler: async (ctx, args) => {
    const { user } = await requireRole(ctx, "donor");
    const config = loadConfig(process.env);
    if (!Number.isSafeInteger(args.amount)) {
      throw appError("VALIDATION", fr.errors.amountNotInteger, "amount");
    }
    if (!isValidDonationAmount(args.amount, config.minDonation)) {
      throw appError(
        "VALIDATION",
        fr.errors.amountTooLow(formatFCFA(config.minDonation)),
        "amount",
      );
    }
    const causeId = ctx.db.normalizeId("causes", args.causeId);
    const cause = causeId && (await ctx.db.get(causeId));
    if (!cause) throw appError("NOT_FOUND", fr.errors.causeNotFound);
    const structure = await ctx.db.get(cause.structureId);
    const now = Date.now();
    if (!isListed(cause, structure) || cause.deadline <= now) {
      throw appError("CONFLICT", fr.errors.causeNotOpen);
    }
    const limit = await hitRateLimit(ctx, `checkout:${user._id}`, {
      max: CHECKOUT_MAX,
      windowMs: CHECKOUT_WINDOW_MS,
    });
    if (!limit.ok) throw appError("RATE_LIMITED", fr.errors.rateLimited);

    // The fee is recomputed here; nothing the client computed is used (DT-6).
    const breakdown = computeFee(args.amount, config.paymentProvider, config.platformFeeRate);
    const donationId = await ctx.db.insert("donations", {
      causeId: cause._id,
      donorId: user._id,
      amount: breakdown.amount,
      fee: breakdown.fee,
      platformFee: breakdown.platformFee,
      net: breakdown.net,
      method: args.method,
      provider: config.paymentProvider,
      status: "pending",
      createdAt: now,
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "donation.create",
      targetTable: "donations",
      targetId: donationId,
      details: {
        causeId: cause._id,
        amount: breakdown.amount,
        method: args.method,
        provider: config.paymentProvider,
      },
    });
    const name = splitFullName(user.name);
    return {
      donationId,
      causeId: cause._id,
      causeTitle: cause.title,
      breakdown,
      customer: user.phone ? { ...name, phone: user.phone } : name,
    };
  },
});

/** Stores NabooPay's `order_id` on the donation (before the donor is redirected). */
export const attachOrder = internalMutation({
  args: { donationId: v.id("donations"), providerTxnId: v.string() },
  handler: async (ctx, { donationId, providerTxnId }) => {
    const taken = await ctx.db
      .query("donations")
      .withIndex("by_txn", (q) => q.eq("providerTxnId", providerTxnId))
      .first();
    if (taken && taken._id !== donationId) {
      throw new Error(`order_id ${providerTxnId} is already used by donation ${taken._id}`);
    }
    await ctx.db.patch(donationId, { providerTxnId });
  },
});

/** NabooPay refused or did not answer the checkout: nothing was charged. */
export const markCheckoutFailed = internalMutation({
  args: { donationId: v.id("donations"), error: v.string() },
  handler: async (ctx, { donationId, error }) => {
    const donation = await ctx.db.get(donationId);
    if (!donation || donation.status !== "pending") return;
    await ctx.db.patch(donationId, { status: "failed" });
    await logAudit(ctx, {
      actorId: donation.donorId,
      action: "donation.checkout_failed",
      targetTable: "donations",
      targetId: donationId,
      details: { error },
    });
  },
});

// ---------------------------------------------------------------------------
// Status (success page, simulator)
// ---------------------------------------------------------------------------

/** The donor's own donation, live. Null for someone else's donation or a malformed id. */
export const status = query({
  args: { donationId: v.string() },
  handler: async (ctx, { donationId }): Promise<DonationStatusView | null> => {
    const { user } = await requireRole(ctx, "donor");
    const donation = await ownDonation(ctx, user._id, donationId);
    if (!donation) return null;
    const cause = await ctx.db.get(donation.causeId);
    return {
      id: donation._id,
      status: donation.status,
      amount: donation.amount,
      fee: donation.fee,
      net: donation.net,
      method: donation.method,
      paidMethod: donation.paidMethod ?? null,
      lateRefund: donation.lateRefundFlaggedAt !== undefined,
      createdAt: donation.createdAt,
      cause: cause && {
        id: cause._id,
        title: cause.title,
        raised: cause.raised,
        goal: cause.goalAmount,
        percent: percentOf(cause.raised, cause.goalAmount),
        status: cause.status,
      },
    };
  },
});

/**
 * Asks NabooPay about a donation still `pending` and records it if it is paid, in case the
 * webhook was missed (DT-3). Called once by the success page.
 */
export const refreshStatus = action({
  args: { donationId: v.string() },
  handler: async (ctx, { donationId }): Promise<{ status: DonationStatus }> => {
    const target = await ctx.runMutation(internal.donations.claimRefresh, { donationId });
    if (!target) throw appError("NOT_FOUND", fr.errors.donationNotFound);
    if (!target.check) return { status: target.status };
    try {
      const transaction = await getPaymentProvider().getTransaction(target.orderId);
      if (isPaidStatus(transaction.status) && transaction.fees !== undefined) {
        await ctx.runMutation(internal.payments.recordPayment, {
          orderId: target.orderId,
          amount: transaction.amount,
          fees: transaction.fees,
          method: transaction.method,
        });
      }
    } catch (error) {
      console.warn(`status check failed for donation ${donationId}: ${String(error)}`);
    }
    const after = await ctx.runMutation(internal.donations.claimRefresh, {
      donationId,
      peek: true,
    });
    return { status: after?.status ?? target.status };
  },
});

/** Owner check + rate limit for `refreshStatus`. `check` is false when NabooPay needn't be asked. */
export const claimRefresh = internalMutation({
  args: { donationId: v.string(), peek: v.optional(v.boolean()) },
  handler: async (
    ctx,
    { donationId, peek },
  ): Promise<
    | { check: true; status: DonationStatus; orderId: string }
    | { check: false; status: DonationStatus }
    | null
  > => {
    const { user } = await requireRole(ctx, "donor");
    const donation = await ownDonation(ctx, user._id, donationId);
    if (!donation) return null;
    if (peek || donation.status !== "pending" || !donation.providerTxnId) {
      return { check: false, status: donation.status };
    }
    const limit = await hitRateLimit(ctx, `refresh:${user._id}`, {
      max: REFRESH_MAX,
      windowMs: REFRESH_WINDOW_MS,
    });
    if (!limit.ok) return { check: false, status: donation.status };
    return { check: true, status: donation.status, orderId: donation.providerTxnId };
  },
});

// ---------------------------------------------------------------------------
// History and impact (donor dashboard, PARCOURS S19)
// ---------------------------------------------------------------------------

async function historyView(
  ctx: QueryCtx,
  donation: Doc<"donations">,
): Promise<DonationHistoryView> {
  const cause = await ctx.db.get(donation.causeId);
  const structure = cause && (await ctx.db.get(cause.structureId));

  const proof =
    cause &&
    (await ctx.db
      .query("proofs")
      .withIndex("by_cause", (q) => q.eq("causeId", cause._id))
      .filter((q) => q.eq(q.field("status"), "validated"))
      .first());
  const proofItems = proof
    ? await ctx.db
        .query("proofItems")
        .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
        .take(100)
    : [];

  const request = await ctx.db
    .query("refundRequests")
    .withIndex("by_donation", (q) => q.eq("donationId", donation._id))
    .first();

  let causeDeleted: DonationHistoryView["causeDeleted"] = null;
  if (cause?.status === "deleted") {
    const deletion = await ctx.db
      .query("deletionRequests")
      .withIndex("by_cause", (q) => q.eq("causeId", cause._id))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .first();
    causeDeleted = {
      reason: deletion?.moderatorReason ?? "",
      outcome: deletion?.fundOutcome === "payout" ? "paidOut" : "refunded",
    };
  }

  const lateRefund = donation.lateRefundFlaggedAt !== undefined;
  return {
    id: donation._id,
    causeId: donation.causeId,
    cause: cause?.title ?? "",
    organization: structure?.name ?? "",
    amount: donation.amount,
    net: donation.net,
    method: donation.paidMethod ?? donation.method,
    date: donation.createdAt,
    status: donation.status,
    lateRefund,
    proof: {
      available: proof !== null && proof !== undefined,
      proofId: proof?._id ?? null,
      itemCount: proofItems.length,
    },
    refund: {
      // Possible while the funds are held, before the cause is released or deleted (DB-2).
      eligible:
        donation.status === "held" &&
        !lateRefund &&
        request === null &&
        cause !== null &&
        cause.status !== "deleted" &&
        cause.fundsReleasedAt === undefined,
      estimatedAmount: donation.net,
      request: request && { status: request.status, refundAmount: request.refundAmount ?? null },
    },
    causeDeleted,
  };
}

/** The donor's donations, newest first. */
export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const { user } = await requireRole(ctx, "donor");
    const result = await ctx.db
      .query("donations")
      .withIndex("by_donor", (q) => q.eq("donorId", user._id))
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(Math.max(paginationOpts.numItems, 1), MAX_PAGE_SIZE),
      });
    const page: DonationHistoryView[] = [];
    for (const donation of result.page) page.push(await historyView(ctx, donation));
    return { ...result, page };
  },
});

/** Confirmed donations (held or released, late payments excluded) and the causes they support. */
export function impactOf(donations: Doc<"donations">[]): DonorImpact {
  const counted = donations.filter(
    (d) => (d.status === "held" || d.status === "released") && d.lateRefundFlaggedAt === undefined,
  );
  return {
    total: counted.reduce((sum, d) => sum + d.amount, 0),
    causeCount: new Set(counted.map((d) => d.causeId)).size,
    donationCount: counted.length,
  };
}

export const impact = query({
  args: {},
  handler: async (ctx): Promise<DonorImpact> => {
    const { user } = await requireRole(ctx, "donor");
    const donations = await ctx.db
      .query("donations")
      .withIndex("by_donor", (q) => q.eq("donorId", user._id))
      .take(IMPACT_SCAN);
    return impactOf(donations);
  },
});

export type { MutationCtx };
