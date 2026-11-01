/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import type { Role } from "../lib/types";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

async function seeded() {
  const t = setup();
  await t.action(internal.seed.run, { fetchImages: false });
  return t;
}

/** A client acting as a new account of `role`; `mfa: false` leaves the SMS step undone. */
async function as(t: T, role: Role, { mfa = true } = {}) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: `Test ${role}`, role, disabled: false, createdAt: Date.now() }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
      ...(mfa ? { mfaVerifiedAt: Date.now() } : {}),
    }),
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

function errorData(error: unknown): { code?: string; field?: string | null } {
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

const featuredIds = (t: T) =>
  t.run(async (ctx) =>
    (await ctx.db.query("causes").collect())
      .filter((c) => c.featuredAt !== undefined)
      .map((c) => c._id),
  );

const causeByTitle = (t: T, title: string) =>
  t.run(async (ctx) => (await ctx.db.query("causes").collect()).find((c) => c.title === title)!);

describe("moderation.setFeatured", () => {
  it("needs a moderator who passed the SMS code", async () => {
    const t = await seeded();
    const cause = await causeByTitle(t, "Moustiquaires imprégnées");
    const args = { causeId: cause._id };
    await expectAppError(t.mutation(api.moderation.setFeatured, args), "UNAUTHENTICATED");
    const { client: donor } = await as(t, "donor");
    await expectAppError(donor.mutation(api.moderation.setFeatured, args), "FORBIDDEN");
    const { client: noMfa } = await as(t, "moderator", { mfa: false });
    await expectAppError(noMfa.mutation(api.moderation.setFeatured, args), "MFA_REQUIRED");
  });

  it("replaces the current Coup de cœur, so only one cause is featured", async () => {
    const t = await seeded();
    const { client, userId } = await as(t, "moderator");
    const { client: donor } = await as(t, "donor");
    const [previous] = await featuredIds(t);
    const cause = await causeByTitle(t, "Moustiquaires imprégnées");

    const result = await client.mutation(api.moderation.setFeatured, { causeId: cause._id });
    expect(result).toEqual({
      ok: true,
      message: "« Moustiquaires imprégnées » est le Coup de cœur de la semaine.",
    });
    expect(await featuredIds(t)).toEqual([cause._id]);
    expect((await donor.query(api.causes.featured, {}))?.id).toBe(cause._id);

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_created", (q) => q.eq("action", "featured.set"))
        .collect(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: userId,
      targetTable: "causes",
      targetId: cause._id,
      details: { previous: [previous] },
    });
  });

  it("clears the Coup de cœur with null", async () => {
    const t = await seeded();
    const { client } = await as(t, "moderator");
    const { client: donor } = await as(t, "donor");
    const [previous] = await featuredIds(t);

    const result = await client.mutation(api.moderation.setFeatured, { causeId: null });
    expect(result.message).toBe("Le Coup de cœur a été retiré.");
    expect(await featuredIds(t)).toEqual([]);
    expect(await donor.query(api.causes.featured, {})).toBeNull();

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_created", (q) => q.eq("action", "featured.clear"))
        .collect(),
    );
    expect(audit.map((a) => a.targetId)).toEqual([previous]);
  });

  it("refuses a cause that is not active or whose structure is not verified", async () => {
    const t = await seeded();
    const { client } = await as(t, "moderator");
    const cause = await causeByTitle(t, "Moustiquaires imprégnées");

    await t.run((ctx) => ctx.db.patch(cause._id, { status: "closed" }));
    await expectAppError(
      client.mutation(api.moderation.setFeatured, { causeId: cause._id }),
      "VALIDATION",
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(cause._id, { status: "active" });
      await ctx.db.patch(cause.structureId, { suspendedAt: Date.now() });
    });
    await expectAppError(
      client.mutation(api.moderation.setFeatured, { causeId: cause._id }),
      "VALIDATION",
    );
    expect(await featuredIds(t)).toHaveLength(1);
  });
});

describe("moderation.featuredCandidates", () => {
  it("lists listed causes with the current pick flagged, for moderators only", async () => {
    const t = await seeded();
    const { client: donor } = await as(t, "donor");
    await expectAppError(donor.query(api.moderation.featuredCandidates, {}), "FORBIDDEN");

    const { client } = await as(t, "moderator");
    const candidates = await client.query(api.moderation.featuredCandidates, {});
    expect(candidates).toHaveLength(7);
    expect(candidates.filter((c) => c.featured).map((c) => c.title)).toEqual([
      "Trois fauteuils roulants adaptés",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Queues + decisions (Sprint 5)
// ---------------------------------------------------------------------------

async function storeFile(t: T, type = "image/png"): Promise<string> {
  return t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(256)], { type })));
}

/** A pending structure (with a payout account) and its responsible user. */
async function pendingStructure(t: T) {
  const receiptFileId = await storeFile(t, "application/pdf");
  const structureId = await t.run((ctx) =>
    ctx.db.insert("structures", {
      name: "Foyer Keur Yaay",
      type: "Foyer",
      region: "Dakar",
      commune: "Rufisque",
      contactName: "Awa Diop",
      phone: "+221770000009",
      email: "keur@example.sn",
      receiptFileId: receiptFileId as never,
      payout: {
        method: "wave",
        accountNumber: "+221770000009",
        holderName: "Awa Diop",
        phoneVerifiedAt: Date.now(),
      },
      status: "pending",
      onboardingPhase: 1,
      createdAt: Date.now(),
    }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Awa Diop",
      role: "structure",
      structureId,
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  return { structureId, userId };
}

async function pendingCause(t: T, structureId: string) {
  const bannerFileId = await storeFile(t);
  return t.run((ctx) =>
    ctx.db.insert("causes", {
      structureId: structureId as never,
      title: "Réfection du dortoir",
      description: "x".repeat(30),
      category: "Matériel",
      bannerFileId: bannerFileId as never,
      endType: "goal",
      goalAmount: 500000,
      deadline: Date.now() + 10 * DAY_MS,
      extensionCount: 0,
      urgency: "normal",
      raised: 0,
      donorCount: 0,
      status: "pending_review",
      submittedAt: Date.now(),
    }),
  );
}

const notificationsFor = (t: T, userId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId as never))
      .collect(),
  );

describe("moderation.queues", () => {
  it("requires a moderator who passed the SMS code", async () => {
    const t = setup();
    await expectAppError(t.query(api.moderation.queues, {}), "UNAUTHENTICATED");
    const { client: donor } = await as(t, "donor");
    await expectAppError(donor.query(api.moderation.queues, {}), "FORBIDDEN");
    const { client: noMfa } = await as(t, "moderator", { mfa: false });
    await expectAppError(noMfa.query(api.moderation.queues, {}), "MFA_REQUIRED");
  });

  it("lists pending structures, causes and proofs", async () => {
    const t = setup();
    const { structureId } = await pendingStructure(t);
    await pendingCause(t, structureId);
    const { client } = await as(t, "moderator");
    const q = await client.query(api.moderation.queues, {});
    expect(q.structures.count).toBe(1);
    expect(q.causes.count).toBe(1);
    expect(q.structures.items[0].hasPayout).toBe(true);
    expect(q.deletions.count).toBe(0);
  });
});

describe("moderation.decideStructure", () => {
  it("approves (verifying the payout account) and refuses with a required reason", async () => {
    const t = setup();
    const { structureId, userId } = await pendingStructure(t);
    const { client } = await as(t, "moderator");

    await expectAppError(
      client.mutation(api.moderation.decideStructure, { structureId, decision: "refuse" }),
      "VALIDATION",
    );

    await client.mutation(api.moderation.decideStructure, { structureId, decision: "approve" });
    const structure = await t.run((ctx) => ctx.db.get(structureId));
    expect(structure!.status).toBe("approved");
    expect(structure!.payout?.verifiedAt).toBeDefined();
    const notes = await notificationsFor(t, userId);
    expect(notes.some((n) => n.kind === "structure_decision")).toBe(true);
  });
});

describe("moderation.decideCause", () => {
  it("approves a cause to active and refuses with a reason, notifying the structure", async () => {
    const t = setup();
    const { structureId, userId } = await pendingStructure(t);
    const toApprove = await pendingCause(t, structureId);
    const toRefuse = await pendingCause(t, structureId);
    const { client } = await as(t, "moderator");

    await client.mutation(api.moderation.decideCause, { causeId: toApprove, decision: "approve" });
    const approved = await t.run((ctx) => ctx.db.get(toApprove));
    expect(approved!.status).toBe("active");
    expect(approved!.approvedAt).toBeDefined();

    await expectAppError(
      client.mutation(api.moderation.decideCause, { causeId: toRefuse, decision: "refuse" }),
      "VALIDATION",
    );
    await client.mutation(api.moderation.decideCause, {
      causeId: toRefuse,
      decision: "refuse",
      reason: "Le devis est manquant.",
    });
    const refused = await t.run((ctx) => ctx.db.get(toRefuse));
    expect(refused).toMatchObject({ status: "refused", refusalReason: "Le devis est manquant." });

    const notes = await notificationsFor(t, userId);
    expect(notes.filter((n) => n.kind === "cause_decision")).toHaveLength(2);
  });
});

describe("moderation.decideProof", () => {
  it("validates a dossier: marks the deadline met and notifies donors", async () => {
    const t = setup();
    const { structureId } = await pendingStructure(t);
    const cause = await pendingCause(t, structureId);
    await t.run((ctx) => ctx.db.patch(cause, { status: "closed", fundsReleasedAt: Date.now() }));

    const { proofId, donorId } = await t.run(async (ctx) => {
      const proofId = await ctx.db.insert("proofs", {
        causeId: cause,
        structureId: structureId as never,
        report: "Compte rendu de la distribution.",
        spend: [],
        status: "submitted",
        dossierFlags: [],
        createdAt: Date.now(),
      });
      await ctx.db.insert("proofDeadlines", {
        causeId: cause,
        structureId: structureId as never,
        reason: "release",
        dueAt: Date.now() + 7 * DAY_MS,
        enforced: true,
      });
      const donorId = await ctx.db.insert("users", {
        name: "Donor",
        role: "donor",
        disabled: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("donations", {
        causeId: cause,
        donorId,
        amount: 1000,
        fee: 30,
        platformFee: 0,
        net: 970,
        method: "wave",
        provider: "mock",
        status: "held",
        createdAt: Date.now(),
      });
      return { proofId, donorId };
    });

    const { client } = await as(t, "moderator");
    await client.mutation(api.moderation.decideProof, { proofId, decision: "validate" });

    const proof = await t.run((ctx) => ctx.db.get(proofId));
    expect(proof!.status).toBe("validated");
    const deadline = await t.run((ctx) =>
      ctx.db
        .query("proofDeadlines")
        .withIndex("by_cause", (q) => q.eq("causeId", cause))
        .unique(),
    );
    expect(deadline!.metAt).toBeDefined();
    const donorNotes = await notificationsFor(t, donorId);
    expect(donorNotes.some((n) => n.kind === "proof_published")).toBe(true);

    // Deciding again is refused (no longer submitted).
    await expectAppError(
      client.mutation(api.moderation.decideProof, { proofId, decision: "validate" }),
      "CONFLICT",
    );
  });

  it("requires a reason to escalate", async () => {
    const t = setup();
    const { structureId } = await pendingStructure(t);
    const cause = await pendingCause(t, structureId);
    await t.run((ctx) => ctx.db.patch(cause, { fundsReleasedAt: Date.now() }));
    const proofId = await t.run((ctx) =>
      ctx.db.insert("proofs", {
        causeId: cause,
        structureId: structureId as never,
        report: "Compte rendu.",
        spend: [],
        status: "submitted",
        dossierFlags: [],
        createdAt: Date.now(),
      }),
    );
    const { client } = await as(t, "moderator");
    await expectAppError(
      client.mutation(api.moderation.decideProof, { proofId, decision: "escalate" }),
      "VALIDATION",
    );
    await client.mutation(api.moderation.decideProof, {
      proofId,
      decision: "escalate",
      reason: "Ajoutez la facture du fournisseur.",
    });
    expect((await t.run((ctx) => ctx.db.get(proofId)))!.status).toBe("escalated");
  });
});
