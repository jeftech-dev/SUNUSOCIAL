/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

function errorData(error: unknown): { code?: string } {
  const data = (error as { data?: unknown }).data;
  return typeof data === "string" ? JSON.parse(data) : ((data as object) ?? {});
}
async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).not.toBeNull();
  expect(errorData(error).code).toBe(code);
}

async function storeFile(t: T): Promise<Id<"_storage">> {
  return t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(16)], { type: "application/pdf" })),
  );
}

async function structureCtx(t: T, withPayout = true) {
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
      ...(withPayout
        ? {
            payout: {
              method: "wave" as const,
              accountNumber: "+221770000001",
              holderName: "Awa Diop",
              phoneVerifiedAt: Date.now(),
              verifiedAt: Date.now(),
            },
          }
        : {}),
      status: "approved" as const,
      onboardingPhase: 1 as const,
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
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId: responsibleId,
      expirationTime: Date.now() + DAY_MS,
      mfaVerifiedAt: Date.now(),
    }),
  );
  return {
    structureId,
    responsibleId,
    client: t.withIdentity({ subject: `${responsibleId}|${sessionId}` }),
  };
}

async function moderatorClient(t: T) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Mod", role: "moderator", disabled: false, createdAt: Date.now() }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
      mfaVerifiedAt: Date.now(),
    }),
  );
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

async function donorCtx(t: T, phone = "+221780000002") {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Donor",
      role: "donor",
      phone,
      phoneVerifiedAt: Date.now(),
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + DAY_MS }),
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

async function activeCause(t: T, structureId: Id<"structures">) {
  const bannerFileId = await storeFile(t);
  return t.run((ctx) =>
    ctx.db.insert("causes", {
      structureId,
      title: "Cantine scolaire",
      description: "desc",
      category: "Alimentation",
      bannerFileId,
      endType: "date",
      goalAmount: 1_000_000,
      deadline: Date.now() + 10 * DAY_MS,
      extensionCount: 0,
      urgency: "normal",
      raised: 0,
      donorCount: 0,
      status: "active",
      submittedAt: Date.now(),
      approvedAt: Date.now(),
    }),
  );
}

async function heldDonation(
  t: T,
  causeId: Id<"causes">,
  donorId: Id<"users">,
  net = 4900,
): Promise<Id<"donations">> {
  return t.run((ctx) =>
    ctx.db.insert("donations", {
      causeId,
      donorId,
      amount: net + 100,
      fee: 100,
      platformFee: 0,
      net,
      method: "wave",
      provider: "mock",
      providerTxnId: `txn_${Math.random().toString(36).slice(2)}`,
      status: "held",
      createdAt: Date.now(),
    }),
  );
}

const getDonation = (t: T, id: Id<"donations">) => t.run((ctx) => ctx.db.get(id));
const getCause = (t: T, id: Id<"causes">) => t.run((ctx) => ctx.db.get(id));
const payouts = (t: T) => t.run((ctx) => ctx.db.query("payouts").collect());

// ---------------------------------------------------------------------------
// Deletion requests
// ---------------------------------------------------------------------------

describe("causes.requestDeletion", () => {
  it("records a pending request for an active cause and rejects duplicates", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    await heldDonation(t, causeId, donor.userId);

    const { requestId } = await s.client.mutation(api.causes.requestDeletion, {
      causeId,
      reason: "Le bénéficiaire a déménagé.",
    });
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "pending" });

    await expectAppError(
      s.client.mutation(api.causes.requestDeletion, { causeId, reason: "encore" }),
      "CONFLICT",
    );
  });

  it("rejects an empty reason and a non-active cause", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const causeId = await activeCause(t, s.structureId);
    await expectAppError(
      s.client.mutation(api.causes.requestDeletion, { causeId, reason: "   " }),
      "VALIDATION",
    );
    await t.run((ctx) => ctx.db.patch(causeId, { status: "closed" }));
    await expectAppError(
      s.client.mutation(api.causes.requestDeletion, { causeId, reason: "x" }),
      "CONFLICT",
    );
  });
});

describe("moderation.decideDeletion", () => {
  it("maintains a cause and notifies the structure", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const { requestId } = await s.client.mutation(api.causes.requestDeletion, {
      causeId,
      reason: "doute",
    });
    await mod.mutation(api.moderation.decideDeletion, {
      requestId,
      decision: "maintain",
      reason: "La cause reste valable.",
    });
    expect(await getCause(t, causeId)).toMatchObject({ status: "active" });
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "maintained" });
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.some((n) => n.kind === "deletion_decision")).toBe(true);
  });

  it("approves with refund: deletes the cause and refunds each donor's net", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId, 4900);
    const { requestId } = await s.client.mutation(api.causes.requestDeletion, {
      causeId,
      reason: "annulée",
    });

    await mod.mutation(api.moderation.decideDeletion, {
      requestId,
      decision: "approve",
      reason: "Projet abandonné.",
      fundOutcome: "refund",
    });
    expect(await getCause(t, causeId)).toMatchObject({ status: "deleted" });
    await t.finishAllScheduledFunctions(() => {});

    const rows = await payouts(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "refund", amount: 4900, targetId: donationId });

    await t.action(internal.payouts.drainNext, {});
    expect((await getDonation(t, donationId))?.status).toBe("refunded");
  });

  it("approves with payout: releases to the structure and opens a deletion proof deadline", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId, 9800);
    const { requestId } = await s.client.mutation(api.causes.requestDeletion, {
      causeId,
      reason: "x",
    });

    await mod.mutation(api.moderation.decideDeletion, {
      requestId,
      decision: "approve",
      reason: "Fonds déjà engagés.",
      fundOutcome: "payout",
    });
    const cause = await getCause(t, causeId);
    expect(cause).toMatchObject({ status: "deleted" });
    expect(cause?.fundsReleasedAt).toBeDefined();
    await t.finishAllScheduledFunctions(() => {});

    const rows = await payouts(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "release", amount: 9800 });

    await t.action(internal.payouts.drainNext, {});
    expect((await getDonation(t, donationId))?.status).toBe("released");
    const deadline = await t.run((ctx) =>
      ctx.db
        .query("proofDeadlines")
        .withIndex("by_cause", (q) => q.eq("causeId", causeId))
        .unique(),
    );
    expect(deadline?.reason).toBe("deletion_payout");
  });

  it("refuses a payout decision while a payout-account change is pending", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    await heldDonation(t, causeId, (await donorCtx(t)).userId);
    const { requestId } = await s.client.mutation(api.causes.requestDeletion, {
      causeId,
      reason: "x",
    });
    await t.run((ctx) =>
      ctx.db.patch(s.structureId, {
        payoutPending: {
          method: "orange_money",
          accountNumber: "+221760000003",
          holderName: "Awa Diop",
          phoneVerifiedAt: Date.now(),
        },
      }),
    );
    await expectAppError(
      mod.mutation(api.moderation.decideDeletion, {
        requestId,
        decision: "approve",
        reason: "r",
        fundOutcome: "payout",
      }),
      "CONFLICT",
    );
  });

  it("requires a fund outcome to approve and rejects a second decision", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const { requestId } = await s.client.mutation(api.causes.requestDeletion, {
      causeId,
      reason: "x",
    });
    await expectAppError(
      mod.mutation(api.moderation.decideDeletion, { requestId, decision: "approve", reason: "r" }),
      "VALIDATION",
    );
    await mod.mutation(api.moderation.decideDeletion, {
      requestId,
      decision: "maintain",
      reason: "garder",
    });
    await expectAppError(
      mod.mutation(api.moderation.decideDeletion, { requestId, decision: "maintain", reason: "r" }),
      "CONFLICT",
    );
  });
});

// ---------------------------------------------------------------------------
// Refund requests
// ---------------------------------------------------------------------------

describe("donations.requestRefund", () => {
  it("creates a request for an eligible held donation", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId);
    const { requestId } = await donor.client.mutation(api.donations.requestRefund, {
      donationId,
      reason: "erreur de cause",
    });
    const request = await t.run((ctx) => ctx.db.get(requestId));
    expect(request).toMatchObject({ status: "pending", receivingPhone: "+221780000002" });
  });

  it("rejects a refund once funds are released, and another donor's donation", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId);
    await t.run((ctx) => ctx.db.patch(causeId, { fundsReleasedAt: Date.now() }));
    await expectAppError(
      donor.client.mutation(api.donations.requestRefund, { donationId, reason: "trop tard" }),
      "CONFLICT",
    );
    const other = await donorCtx(t, "+221780000099");
    await expectAppError(
      other.client.mutation(api.donations.requestRefund, { donationId, reason: "pas à moi" }),
      "FORBIDDEN",
    );
  });
});

describe("moderation.decideRefund", () => {
  it("approves a refund: queues a net payout and marks the donation refunded", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId, 4900);
    const { requestId } = await donor.client.mutation(api.donations.requestRefund, {
      donationId,
      reason: "erreur",
    });

    const res = await mod.mutation(api.moderation.decideRefund, {
      requestId,
      decision: "refunded",
    });
    expect(res.refundAmount).toBe(4900);
    const rows = await payouts(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "refund", amount: 4900, targetId: donationId });

    await t.action(internal.payouts.drainNext, {});
    expect((await getDonation(t, donationId))?.status).toBe("refunded");
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "refunded" });
  });

  it("rejects a refund and notifies the donor, with no payout", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId);
    const { requestId } = await donor.client.mutation(api.donations.requestRefund, {
      donationId,
      reason: "erreur",
    });
    await mod.mutation(api.moderation.decideRefund, { requestId, decision: "rejected" });
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "rejected" });
    expect(await payouts(t)).toHaveLength(0);
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.some((n) => n.kind === "refund_decision")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

describe("moderation.queues (deletions + refunds)", () => {
  it("lists pending deletion and refund requests", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const donor = await donorCtx(t);
    const donationId = await heldDonation(t, causeId, donor.userId, 4900);
    await s.client.mutation(api.causes.requestDeletion, { causeId, reason: "x" });
    await donor.client.mutation(api.donations.requestRefund, { donationId, reason: "y" });

    const queues = await mod.query(api.moderation.queues, {});
    expect(queues.deletions.count).toBe(1);
    expect(queues.deletions.items[0]).toMatchObject({ cause: "Cantine scolaire", raised: 0 });
    expect(queues.refunds.count).toBe(1);
    expect(queues.refunds.items[0]).toMatchObject({ amount: 4900, donor: "Donor" });
  });
});
