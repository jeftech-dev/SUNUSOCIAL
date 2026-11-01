/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import { fr } from "../lib/strings.fr";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

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

async function storeFile(t: T, type = "image/png", bytes = 512): Promise<Id<"_storage">> {
  return t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
}

async function asStructure(t: T) {
  const receiptFileId = await storeFile(t, "application/pdf");
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
      status: "approved",
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
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
      mfaVerifiedAt: Date.now(),
    }),
  );
  return { structureId, userId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

async function donorClient(t: T) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Donor", role: "donor", disabled: false, createdAt: Date.now() }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + DAY_MS }),
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

async function moderatorClient(t: T) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Mod",
      role: "moderator",
      disabled: false,
      createdAt: Date.now(),
    }),
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

/** A funded cause (funds released → a proof is due) owned by `structureId`. */
async function fundedCause(t: T, structureId: Id<"structures">): Promise<Id<"causes">> {
  const bannerFileId = await storeFile(t);
  return t.run((ctx) =>
    ctx.db.insert("causes", {
      structureId,
      title: "Riz et huile",
      description: "Distribution alimentaire de novembre.",
      category: "Alimentation",
      bannerFileId,
      endType: "goal",
      goalAmount: 100000,
      deadline: Date.now() + DAY_MS,
      extensionCount: 0,
      urgency: "normal",
      raised: 0,
      donorCount: 0,
      status: "closed",
      submittedAt: Date.now(),
      fundsReleasedAt: Date.now(),
    }),
  );
}

async function photoItems(t: T, n: number) {
  const items: Array<{ kind: Doc<"proofItems">["kind"]; fileId: Id<"_storage">; caption?: string }> =
    [];
  for (let i = 0; i < n; i++) {
    items.push({ kind: "photo", fileId: await storeFile(t, "image/png", 512 + i), caption: `p${i}` });
  }
  return items;
}

const REPORT = "22 moustiquaires installées le 9 octobre dans les dortoirs.";

describe("proofs.submit", () => {
  it("rejects non-owners and causes whose funds are not released", async () => {
    const t = setup();
    const owner = await asStructure(t);
    const notFundedBanner = await storeFile(t);
    const notFunded = await t.run((ctx) =>
      ctx.db.insert("causes", {
        structureId: owner.structureId,
        title: "Pas financée",
        description: "x".repeat(30),
        category: "Santé",
        bannerFileId: notFundedBanner,
        endType: "date",
        goalAmount: 1000,
        deadline: Date.now() + DAY_MS,
        extensionCount: 0,
        urgency: "normal",
        raised: 0,
        donorCount: 0,
        status: "active",
        submittedAt: Date.now(),
      }),
    );
    const items = await photoItems(t, 5);
    await expectAppError(
      owner.client.mutation(api.proofs.submit, {
        causeId: notFunded,
        report: REPORT,
        items,
        spend: [{ label: "Riz", amount: 1000 }],
      }),
      "CONFLICT",
    );

    const funded = await fundedCause(t, owner.structureId);
    const other = await asStructure(t);
    await expectAppError(
      other.client.mutation(api.proofs.submit, {
        causeId: funded,
        report: REPORT,
        items: await photoItems(t, 5),
        spend: [{ label: "Riz", amount: 1000 }],
      }),
      "FORBIDDEN",
    );
  });

  it("enforces the minimum item count and report length, and one dossier per cause", async () => {
    const t = setup();
    const owner = await asStructure(t);
    const cause = await fundedCause(t, owner.structureId);
    await expectAppError(
      owner.client.mutation(api.proofs.submit, {
        causeId: cause,
        report: REPORT,
        items: await photoItems(t, 4),
        spend: [],
      }),
      "VALIDATION",
    );
    await expectAppError(
      owner.client.mutation(api.proofs.submit, {
        causeId: cause,
        report: "court",
        items: await photoItems(t, 5),
        spend: [],
      }),
      "VALIDATION",
    );
    await owner.client.mutation(api.proofs.submit, {
      causeId: cause,
      report: REPORT,
      items: await photoItems(t, 5),
      spend: [{ label: "Riz", amount: 100 }],
    });
    await expectAppError(
      owner.client.mutation(api.proofs.submit, {
        causeId: cause,
        report: REPORT,
        items: await photoItems(t, 5),
        spend: [],
      }),
      "CONFLICT",
    );
  });

  it("flags a reused invoice reference and a spend total that is off", async () => {
    const t = setup();
    const owner = await asStructure(t);
    const cause = await fundedCause(t, owner.structureId);
    const earlierCause = await fundedCause(t, owner.structureId);
    // A held donation of net 100 000 so the spend total below is far off.
    await t.run(async (ctx) => {
      const donor = await ctx.db.insert("users", {
        name: "D",
        role: "donor",
        disabled: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("donations", {
        causeId: cause,
        donorId: donor,
        amount: 103000,
        fee: 3000,
        platformFee: 0,
        net: 100000,
        method: "wave",
        provider: "mock",
        status: "held",
        createdAt: Date.now(),
      });
      // An earlier dossier (on another cause) with the same supplier + ref.
      const otherProof = await ctx.db.insert("proofs", {
        causeId: earlierCause,
        structureId: owner.structureId,
        report: REPORT,
        spend: [],
        status: "validated",
        dossierFlags: [],
        createdAt: Date.now(),
      });
      await ctx.db.insert("proofItems", {
        proofId: otherProof,
        kind: "invoice",
        fileId: await storeFileInline(ctx),
        supplier: "Pharmacie Kadior",
        ref: "FAC-1187",
        flagged: false,
      });
    });

    const items = [
      ...(await photoItems(t, 4)),
      {
        kind: "invoice" as const,
        fileId: await storeFile(t, "application/pdf"),
        supplier: "Pharmacie Kadior",
        ref: "FAC-1187",
      },
    ];
    const result = await owner.client.mutation(api.proofs.submit, {
      causeId: cause,
      report: REPORT,
      items,
      spend: [{ label: "Riz", amount: 10000 }],
    });
    expect(result.autoFlagged.map((f) => f.index)).toContain(4);

    const proof = await t.run((ctx) =>
      ctx.db
        .query("proofs")
        .withIndex("by_cause", (q) => q.eq("causeId", cause))
        .filter((q) => q.eq(q.field("status"), "submitted"))
        .unique(),
    );
    expect(proof!.dossierFlags.length).toBe(1);
  });

  it("runs the image checks: missing EXIF and exact-duplicate photos", async () => {
    const t = setup();
    const owner = await asStructure(t);
    const cause = await fundedCause(t, owner.structureId);

    // A validated dossier (on another cause) whose photo shares bytes with one of the new photos.
    const dupFile = await storeFile(t, "image/png", 777);
    const earlierCause = await fundedCause(t, owner.structureId);
    await t.run(async (ctx) => {
      const p = await ctx.db.insert("proofs", {
        causeId: earlierCause,
        structureId: owner.structureId,
        report: REPORT,
        spend: [],
        status: "validated",
        dossierFlags: [],
        createdAt: Date.now(),
      });
      await ctx.db.insert("proofItems", {
        proofId: p,
        kind: "photo",
        fileId: await ctx.storage.store(new Blob([new Uint8Array(777)], { type: "image/png" })),
        flagged: false,
      });
    });

    const items = [
      { kind: "photo" as const, fileId: dupFile },
      ...(await photoItems(t, 4)),
    ];
    const { proofId } = await owner.client.mutation(api.proofs.submit, {
      causeId: cause,
      report: REPORT,
      items,
      spend: [],
    });
    await t.finishAllScheduledFunctions(() => {});

    const flagged = await t.run((ctx) =>
      ctx.db
        .query("proofItems")
        .withIndex("by_proof", (q) => q.eq("proofId", proofId))
        .collect(),
    );
    const reasons = flagged.filter((i) => i.flagged).map((i) => i.flagReason);
    expect(reasons).toContain(fr.proofFlags.duplicateImage);
    expect(reasons).toContain(fr.proofFlags.exifMissing);
  });
});

describe("proofs reads", () => {
  async function submittedProof(t: T, owner: Awaited<ReturnType<typeof asStructure>>) {
    const cause = await fundedCause(t, owner.structureId);
    const { proofId } = await owner.client.mutation(api.proofs.submit, {
      causeId: cause,
      report: REPORT,
      items: await photoItems(t, 5),
      spend: [{ label: "Riz", amount: 100 }],
    });
    return { cause, proofId };
  }

  it("hides a non-validated dossier from donors but shows it (with flags) to owner/moderator", async () => {
    const t = setup();
    const owner = await asStructure(t);
    const { proofId } = await submittedProof(t, owner);

    const donor = await donorClient(t);
    expect(await donor.client.query(api.proofs.get, { proofId })).toBeNull();

    const asOwner = await owner.client.query(api.proofs.get, { proofId });
    expect(asOwner?.status).toBe("submitted");

    const mod = await moderatorClient(t);
    const asMod = await mod.query(api.proofs.get, { proofId });
    expect(asMod?.items.length).toBe(5);
  });

  it("exposes a validated dossier to donors without flags, and lists it in the feeds", async () => {
    const t = setup();
    const owner = await asStructure(t);
    const { cause, proofId } = await submittedProof(t, owner);
    await t.run((ctx) => ctx.db.patch(proofId, { status: "validated", validatedAt: Date.now() }));

    const donor = await donorClient(t);
    const view = await donor.client.query(api.proofs.get, { proofId });
    expect(view?.status).toBe("validated");
    expect(view!.items.every((i) => i.flagged === false)).toBe(true);
    expect(view!.dossierFlags).toEqual([]);

    const feed = await t.query(api.proofs.publicFeed, {});
    expect(feed.map((c) => c.proofId)).toContain(proofId);

    // A donor who gave to this cause sees it in `mine`.
    await t.run((ctx) =>
      ctx.db.insert("donations", {
        causeId: cause,
        donorId: donor.userId,
        amount: 1000,
        fee: 30,
        platformFee: 0,
        net: 970,
        method: "wave",
        provider: "mock",
        status: "held",
        createdAt: Date.now(),
      }),
    );
    const mine = await donor.client.query(api.proofs.mine, {});
    expect(mine.map((c) => c.proofId)).toContain(proofId);
  });
});

/** Stores a dummy file from inside a `t.run` transaction. */
async function storeFileInline(ctx: {
  storage: { store: (b: Blob) => Promise<Id<"_storage">> };
}): Promise<Id<"_storage">> {
  return ctx.storage.store(new Blob([new Uint8Array(256)], { type: "image/png" }));
}
