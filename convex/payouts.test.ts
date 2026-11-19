/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

// The mock provider reads MOCK_PAYOUT_* from the environment (lib/providers/mock.ts). Clear them
// after every test so one test's outcome never leaks into the next.
const MOCK_ENV_KEYS = [
  "MOCK_PAYOUT_MODE",
  "MOCK_PAYOUT_BALANCE",
  "MOCK_PAYOUT_GET_STATUS",
  "MOCK_PAYOUT_RECONCILE_AMOUNT",
  "MOCK_PAYOUT_RECONCILE_STATUS",
  "MOCK_PAYOUT_RECONCILE_DECOY_AMOUNT",
];
afterEach(() => {
  for (const key of MOCK_ENV_KEYS) delete process.env[key];
});

async function storeFile(t: T): Promise<Id<"_storage">> {
  return t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(16)], { type: "application/pdf" })),
  );
}

/** An approved structure with a verified Wave payout account and a responsible user. */
async function fundedStructure(t: T) {
  const receiptFileId = await storeFile(t);
  const structureId = await t.run((ctx) =>
    ctx.db.insert("structures", {
      name: "Foyer Jàmm",
      type: "Foyer",
      region: "Dakar",
      commune: "Rufisque",
      contactName: "Awa Diop",
      phone: "+221770000001",
      email: "jamm@example.sn",
      receiptFileId,
      payout: {
        method: "wave",
        accountNumber: "+221770000001",
        holderName: "Awa Diop",
        phoneVerifiedAt: Date.now(),
        verifiedAt: Date.now(),
      },
      status: "approved",
      onboardingPhase: 1,
      createdAt: Date.now(),
    }),
  );
  const responsibleId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Awa Diop",
      role: "structure",
      structureId,
      phone: "+221770000001",
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  return { structureId, responsibleId };
}

async function moderator(t: T) {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Mod",
      role: "moderator",
      disabled: false,
      createdAt: Date.now(),
    }),
  );
}

/** An active cause with `nets.length` held donations of the given net amounts. */
async function causeWithDonations(
  t: T,
  structureId: Id<"structures">,
  nets: number[],
  opts: { status?: "active" | "closed"; deadline?: number } = {},
) {
  const now = Date.now();
  const bannerFileId = await storeFile(t);
  const causeId = await t.run((ctx) =>
    ctx.db.insert("causes", {
      structureId,
      title: "Cantine scolaire",
      description: "d",
      category: "Alimentation",
      bannerFileId,
      endType: "date",
      goalAmount: 1_000_000,
      deadline: opts.deadline ?? now + 10 * DAY_MS,
      extensionCount: 0,
      urgency: "normal",
      raised: 0,
      donorCount: 0,
      status: opts.status ?? "active",
      submittedAt: now,
      approvedAt: now,
    }),
  );
  const donationIds: Id<"donations">[] = [];
  for (const net of nets) {
    const donorId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Donor",
        role: "donor",
        phone: "+221780000002",
        phoneVerifiedAt: now,
        disabled: false,
        createdAt: now,
      }),
    );
    const id = await t.run((ctx) =>
      ctx.db.insert("donations", {
        causeId,
        donorId,
        amount: net + 100,
        fee: 100,
        platformFee: 0,
        net,
        method: "wave",
        provider: "mock",
        providerTxnId: `txn_${net}_${Math.random().toString(36).slice(2)}`,
        status: "held",
        createdAt: now,
      }),
    );
    donationIds.push(id);
  }
  return { causeId, donationIds };
}

const getCause = (t: T, id: Id<"causes">) => t.run((ctx) => ctx.db.get(id));
const getDonation = (t: T, id: Id<"donations">) => t.run((ctx) => ctx.db.get(id));
const onlyPayout = (t: T) =>
  t.run(async (ctx) => {
    const rows = await ctx.db.query("payouts").collect();
    expect(rows.length).toBe(1);
    return rows[0];
  });
const notificationsOfKind = (t: T, kind: string) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .collect()
      .then((rows) => rows.filter((n) => n.kind === kind)),
  );

// ---------------------------------------------------------------------------
// releaseCause
// ---------------------------------------------------------------------------

describe("releaseCause", () => {
  it("queues one release payout of the net sum and is idempotent", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [4900, 9800]);

    const first = await t.mutation(internal.payments.releaseCause, { causeId });
    expect(first.released).toBe(true);

    const payout = await onlyPayout(t);
    expect(payout.kind).toBe("release");
    expect(payout.amount).toBe(4900 + 9800);
    expect(payout.method).toBe("wave");
    expect(payout.status).toBe("queued");

    const cause = await getCause(t, causeId);
    expect(cause?.fundsReleasedAt).toBeDefined();
    expect(cause?.status).toBe("closed");
    expect(cause?.releasePayoutId).toBe(payout._id);

    // Second call does nothing: still exactly one payout.
    const second = await t.mutation(internal.payments.releaseCause, { causeId });
    expect(second.released).toBe(false);
    await onlyPayout(t);
  });

  it("is blocked while a payout-account change is pending", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.run((ctx) =>
      ctx.db.patch(structureId, {
        payoutPending: {
          method: "orange_money",
          accountNumber: "+221760000003",
          holderName: "Awa Diop",
          phoneVerifiedAt: Date.now(),
        },
      }),
    );
    const res = await t.mutation(internal.payments.releaseCause, { causeId });
    expect(res.released).toBe(false);
    const cause = await getCause(t, causeId);
    expect(cause?.fundsReleasedAt).toBeUndefined();
    const payouts = await t.run((ctx) => ctx.db.query("payouts").collect());
    expect(payouts.length).toBe(0);
  });

  it("releases an empty cause without a payout or proof deadline", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, []);
    const res = await t.mutation(internal.payments.releaseCause, { causeId });
    expect(res.released).toBe(true);
    const payouts = await t.run((ctx) => ctx.db.query("payouts").collect());
    expect(payouts.length).toBe(0);
    const deadlines = await t.run((ctx) => ctx.db.query("proofDeadlines").collect());
    expect(deadlines.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The worker: drainNext
// ---------------------------------------------------------------------------

describe("drainNext", () => {
  it("completes a release: donations released, proof deadline opened, structure notified", async () => {
    const t = setup();
    const { structureId, responsibleId } = await fundedStructure(t);
    const { causeId, donationIds } = await causeWithDonations(t, structureId, [4900, 9800]);
    await t.mutation(internal.payments.releaseCause, { causeId });

    const res = await t.action(internal.payouts.drainNext, {});
    expect(res.processed).toBe(1);

    const payout = await onlyPayout(t);
    expect(payout.status).toBe("completed");
    expect(payout.providerOrderId).toBeDefined();

    for (const id of donationIds) {
      expect((await getDonation(t, id))?.status).toBe("released");
    }
    const deadline = await t.run((ctx) =>
      ctx.db
        .query("proofDeadlines")
        .withIndex("by_cause", (q) => q.eq("causeId", causeId))
        .unique(),
    );
    expect(deadline?.reason).toBe("release");
    expect(deadline?.enforced).toBe(true);

    const notes = await notificationsOfKind(t, "funds_released");
    expect(notes.some((n) => n.userId === responsibleId)).toBe(true);
  });

  it("runs one payout at a time (single-flight)", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    // A payout already in flight blocks the claim.
    await t.run((ctx) =>
      ctx.db.insert("payouts", {
        kind: "release",
        targetId: "x",
        amount: 1000,
        method: "wave",
        phone: "+221770000009",
        name: "Other",
        status: "sending",
        attempts: 0,
        createdAt: Date.now(),
      }),
    );
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });

    const res = await t.action(internal.payouts.drainNext, {});
    expect(res.processed).toBe(0);
    const queued = await t.run((ctx) =>
      ctx.db
        .query("payouts")
        .withIndex("by_status_created", (q) => q.eq("status", "queued"))
        .collect(),
    );
    expect(queued.length).toBe(1); // our release is untouched
  });

  it("retries a 409 without resending, then completes", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });

    process.env.MOCK_PAYOUT_MODE = "conflict";
    await t.action(internal.payouts.drainNext, {});
    let payout = await onlyPayout(t);
    expect(payout.status).toBe("queued");
    expect(payout.attempts).toBe(1);

    delete process.env.MOCK_PAYOUT_MODE;
    await t.action(internal.payouts.drainNext, {});
    payout = await onlyPayout(t);
    expect(payout.status).toBe("completed");
  });

  it("marks a timeout unknown and never resends", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId, donationIds } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });

    process.env.MOCK_PAYOUT_MODE = "timeout";
    await t.action(internal.payouts.drainNext, {});
    const payout = await onlyPayout(t);
    expect(payout.status).toBe("unknown");
    // Funds not moved: the donation is still held until reconciliation.
    expect((await getDonation(t, donationIds[0]))?.status).toBe("held");
  });

  it("stops and alerts moderators on a short balance", async () => {
    const t = setup();
    const modId = await moderator(t);
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });

    process.env.MOCK_PAYOUT_BALANCE = "100";
    const res = await t.action(internal.payouts.drainNext, {});
    expect(res.processed).toBe(0);
    const payout = await onlyPayout(t);
    expect(payout.status).toBe("queued");
    const alerts = await notificationsOfKind(t, "payout_alert");
    expect(alerts.some((n) => n.userId === modId)).toBe(true);
  });

  it("skips an under-funded payout, pays a smaller one behind it, and alerts once", async () => {
    const t = setup();
    const modId = await moderator(t);
    const { structureId } = await fundedStructure(t);
    const big = await causeWithDonations(t, structureId, [10000]);
    await t.mutation(internal.payments.releaseCause, { causeId: big.causeId });
    const small = await causeWithDonations(t, structureId, [100]);
    await t.mutation(internal.payments.releaseCause, { causeId: small.causeId });

    process.env.MOCK_PAYOUT_BALANCE = "5000"; // covers the small payout, not the big one
    const res = await t.action(internal.payouts.drainNext, {});
    expect(res.processed).toBe(1);

    const payouts = await t.run((ctx) => ctx.db.query("payouts").collect());
    expect(payouts.find((p) => p.amount === 10000)?.status).toBe("queued"); // left for later
    expect(payouts.find((p) => p.amount === 100)?.status).toBe("completed"); // not blocked by the head

    const alerts = await notificationsOfKind(t, "payout_alert");
    expect(alerts.filter((n) => n.userId === modId).length).toBe(1); // one alert, not per tick-item
  });

  it("never releases a late-flagged donation to the structure", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId, donationIds } = await causeWithDonations(t, structureId, [5000, 7000]);
    // The second donation arrived late (flagged for a donor refund) but is still held.
    await t.run((ctx) => ctx.db.patch(donationIds[1], { lateRefundFlaggedAt: Date.now() }));

    await t.mutation(internal.payments.releaseCause, { causeId });
    const payout = await onlyPayout(t);
    expect(payout.amount).toBe(5000); // the late donation is excluded from the release sum

    await t.action(internal.payouts.drainNext, {});
    expect((await getDonation(t, donationIds[0]))?.status).toBe("released");
    // The late one stays held for lateRefundDue; it is not released to the structure.
    expect((await getDonation(t, donationIds[1]))?.status).toBe("held");
  });

  it("holds a large payout for manual review", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [3_000_000]);
    await t.mutation(internal.payments.releaseCause, { causeId });

    process.env.MOCK_PAYOUT_MODE = "pending";
    await t.action(internal.payouts.drainNext, {});
    const payout = await onlyPayout(t);
    expect(payout.status).toBe("pending_review");

    // The review resolves as completed on the next poll.
    process.env.MOCK_PAYOUT_GET_STATUS = "completed";
    await t.action(internal.payouts.pollPendingReview, {});
    expect((await onlyPayout(t)).status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// reconcile
// ---------------------------------------------------------------------------

describe("reconcile", () => {
  it("resolves an unknown payout found at NabooPay as completed", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId, donationIds } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });
    const payout = await onlyPayout(t);
    await t.run((ctx) => ctx.db.patch(payout._id, { status: "unknown", error: "timeout" }));

    process.env.MOCK_PAYOUT_RECONCILE_AMOUNT = "5000";
    const res = await t.action(internal.payouts.reconcile, { payoutId: payout._id });
    expect(res.status).toBe("completed");
    expect((await getDonation(t, donationIds[0]))?.status).toBe("released");
  });

  it("requeues an unknown payout that NabooPay never created", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });
    const payout = await onlyPayout(t);
    await t.run((ctx) => ctx.db.patch(payout._id, { status: "unknown", error: "timeout" }));

    const res = await t.action(internal.payouts.reconcile, { payoutId: payout._id });
    expect(res.status).toBe("queued");
    expect((await onlyPayout(t)).attempts).toBe(1);
  });

  it("moves a still-processing unknown payout to pending_review instead of leaving it stuck", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });
    const payout = await onlyPayout(t);
    await t.run((ctx) => ctx.db.patch(payout._id, { status: "unknown", error: "timeout" }));

    process.env.MOCK_PAYOUT_RECONCILE_AMOUNT = "5000";
    process.env.MOCK_PAYOUT_RECONCILE_STATUS = "pending";
    const res = await t.action(internal.payouts.reconcile, { payoutId: payout._id });
    expect(res.status).toBe("pending_review");
    const row = await onlyPayout(t);
    expect(row.status).toBe("pending_review"); // pollPendingReview now owns it
    expect(row.providerOrderId).toBeDefined();
  });

  it("does not mistake a same-amount payout already recorded on another row", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.mutation(internal.payments.releaseCause, { causeId });
    const payout = await onlyPayout(t);
    await t.run((ctx) => ctx.db.patch(payout._id, { status: "unknown", error: "timeout" }));
    // A different, already-completed payout of the identical amount to the same wallet.
    await t.run((ctx) =>
      ctx.db.insert("payouts", {
        kind: "release",
        targetId: "other",
        amount: 5000,
        method: "wave",
        phone: "+221770000001",
        name: "Awa Diop",
        status: "completed",
        providerOrderId: "mock_decoy_+221770000001",
        attempts: 0,
        createdAt: Date.now(),
      }),
    );

    process.env.MOCK_PAYOUT_RECONCILE_AMOUNT = "5000";
    process.env.MOCK_PAYOUT_RECONCILE_DECOY_AMOUNT = "5000"; // listed first, but already claimed
    const res = await t.action(internal.payouts.reconcile, { payoutId: payout._id });
    expect(res.status).toBe("completed");
    const resolved = await t.run((ctx) => ctx.db.get(payout._id));
    // It matched the genuinely-unaccounted item, not the already-recorded decoy.
    expect(resolved?.providerOrderId).toBe("mock_recon_+221770000001");
  });
});

// ---------------------------------------------------------------------------
// Late-payment refunds, release cron, proof-deadline suspension
// ---------------------------------------------------------------------------

describe("fund-rule crons", () => {
  it("pays out the net of a late-flagged donation, once", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    // A closed cause with a donation that arrived late (flagged, still held).
    const { causeId, donationIds } = await causeWithDonations(t, structureId, [7000], {
      status: "closed",
    });
    await t.run((ctx) => ctx.db.patch(donationIds[0], { lateRefundFlaggedAt: Date.now() }));

    const first = await t.mutation(internal.payments.lateRefundDue, {});
    expect(first.queued).toBe(1);
    // Idempotent: a second sweep does not enqueue again.
    const second = await t.mutation(internal.payments.lateRefundDue, {});
    expect(second.queued).toBe(0);

    const payout = await onlyPayout(t);
    expect(payout.kind).toBe("refund");
    expect(payout.amount).toBe(7000);
    expect(payout.targetId).toBe(donationIds[0]);

    await t.action(internal.payouts.drainNext, {});
    expect((await getDonation(t, donationIds[0]))?.status).toBe("refunded");
    const request = await t.run((ctx) =>
      ctx.db
        .query("refundRequests")
        .withIndex("by_donation", (q) => q.eq("donationId", donationIds[0]))
        .unique(),
    );
    expect(request?.status).toBe("refunded");
    expect(request?.refundAmount).toBe(7000);
    void causeId;
  });

  it("releaseDue schedules a release for a cause past its deadline", async () => {
    const t = setup();
    const { structureId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000], {
      deadline: Date.now() - DAY_MS,
    });
    const res = await t.mutation(internal.payments.releaseDue, {});
    expect(res.scheduled).toBe(1);
    await t.finishAllScheduledFunctions(() => {});
    const cause = await getCause(t, causeId);
    expect(cause?.fundsReleasedAt).toBeDefined();
  });

  it("suspends a structure that missed its proof deadline", async () => {
    const t = setup();
    const { structureId, responsibleId } = await fundedStructure(t);
    const { causeId } = await causeWithDonations(t, structureId, [5000]);
    await t.run((ctx) =>
      ctx.db.insert("proofDeadlines", {
        causeId,
        structureId,
        reason: "release",
        dueAt: Date.now() - DAY_MS,
        enforced: true,
      }),
    );
    const res = await t.mutation(internal.payments.enforceProofDeadlines, {});
    expect(res.suspended).toBe(1);
    expect((await t.run((ctx) => ctx.db.get(structureId)))?.suspendedAt).toBeDefined();
    const notes = await notificationsOfKind(t, "account_suspended");
    expect(notes.some((n) => n.userId === responsibleId)).toBe(true);
  });
});

// A smoke check that the public API surface is unchanged (no accidental export regressions).
void api;
