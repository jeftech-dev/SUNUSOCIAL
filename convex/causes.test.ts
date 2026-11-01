/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import { computeFee } from "../lib/money";
import type { CauseCardView, Role } from "../lib/types";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeds the demo data: 7 active causes from approved structures, one featured. */
async function seeded() {
  const t = setup();
  await t.action(internal.seed.run, { fetchImages: false });
  return t;
}

/** A client acting as a new account of `role` (SMS code passed for roles that need it). */
async function as(t: T, role: Role) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: `Test ${role}`,
      role,
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
      ...(role === "donor" ? {} : { mfaVerifiedAt: Date.now() }),
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

type Client = Awaited<ReturnType<typeof as>>["client"];
type ListArgs = {
  category?: Doc<"causes">["category"];
  filter?: "urgent" | "almost" | "recent";
  query?: string;
};

/** Every page of `causes.list`, flattened. */
async function listAll(client: Client, args: ListArgs = {}, numItems = 50) {
  const all: CauseCardView[] = [];
  let cursor: string | null = null;
  for (;;) {
    const result: { page: CauseCardView[]; isDone: boolean; continueCursor: string } =
      await client.query(api.causes.list, {
        ...args,
        paginationOpts: { numItems, cursor },
      });
    all.push(...result.page);
    if (result.isDone) return all;
    cursor = result.continueCursor;
  }
}

const causeByTitle = (t: T, title: string) =>
  t.run(async (ctx) => {
    const cause = (await ctx.db.query("causes").collect()).find((c) => c.title === title);
    if (!cause) throw new Error(`no cause "${title}"`);
    return cause;
  });

/** Inserts an extra cause, by default active and from the first approved structure. */
async function insertCause(
  t: T,
  overrides: Partial<Doc<"causes">> & { title: string },
): Promise<Id<"causes">> {
  return t.run(async (ctx) => {
    const template = (await ctx.db.query("causes").first())!;
    const { _id, _creationTime, featuredAt, ...fields } = template;
    void _id;
    void _creationTime;
    void featuredAt;
    return ctx.db.insert("causes", { ...fields, ...overrides });
  });
}

// ---------------------------------------------------------------------------
// causes.list
// ---------------------------------------------------------------------------

describe("causes.list", () => {
  it("requires a signed-in donor or moderator", async () => {
    const t = await seeded();
    const args = { paginationOpts: { numItems: 10, cursor: null } };
    await expectAppError(t.query(api.causes.list, args), "UNAUTHENTICATED");
    const { client: structure } = await as(t, "structure");
    await expectAppError(structure.query(api.causes.list, args), "FORBIDDEN");
    const { client: moderator } = await as(t, "moderator");
    expect((await moderator.query(api.causes.list, args)).page.length).toBeGreaterThan(0);
  });

  it("lists active causes of verified structures, soonest deadline first", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const all = await listAll(client);
    expect(all).toHaveLength(7);

    const deadlines = all.map((c) => c.endCondition.deadline);
    expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));

    const first = all[0];
    expect(first.organization.verified).toBe(true);
    expect(first.bannerUrl).toMatch(/^https?:\/\//);
    expect(Number.isInteger(first.percent)).toBe(true);
  });

  it("hides causes that are not active or whose structure is not verified", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const pendingStructure = await t.run(async (ctx) =>
      (await ctx.db.query("structures").collect()).find((s) => s.status === "pending"),
    );
    await insertCause(t, { title: "Structure en attente", structureId: pendingStructure!._id });
    await insertCause(t, { title: "Cause en modération", status: "pending_review" });
    await insertCause(t, { title: "Cause refusée", status: "refused" });
    await insertCause(t, { title: "Cause clôturée", status: "closed" });

    const suspended = await causeByTitle(t, "Kits d'hygiène pour 80 détenues");
    await t.run((ctx) => ctx.db.patch(suspended.structureId, { suspendedAt: Date.now() }));

    const titles = (await listAll(client)).map((c) => c.title);
    expect(titles).toHaveLength(6);
    expect(titles).not.toContain("Kits d'hygiène pour 80 détenues");
    for (const hidden of [
      "Structure en attente",
      "Cause en modération",
      "Cause refusée",
      "Cause clôturée",
    ]) {
      expect(titles).not.toContain(hidden);
    }
  });

  it("narrows by category and by the Urgent / Presque atteint filters", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");

    const sante = await listAll(client, { category: "Santé" });
    expect(sante.map((c) => c.category)).toEqual(["Santé", "Santé", "Santé"]);

    const urgent = await listAll(client, { filter: "urgent" });
    expect(urgent).toHaveLength(3);
    expect(urgent.every((c) => c.urgent)).toBe(true);

    const almost = await listAll(client, { filter: "almost" });
    expect(almost.map((c) => c.title).sort()).toEqual(
      [
        "Moustiquaires imprégnées",
        "Riz, huile et sucre pour novembre",
        "Trois fauteuils roulants adaptés",
      ].sort(),
    );
    expect(almost.every((c) => c.percent >= 75)).toBe(true);

    const urgentSante = await listAll(client, { category: "Santé", filter: "urgent" });
    expect(urgentSante.map((c) => c.title)).toEqual(["Kits d'hygiène pour 80 détenues"]);
  });

  it("orders Récent by newest approval first", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    await insertCause(t, { title: "Toute nouvelle cause", approvedAt: Date.now() });

    const recent = await listAll(client, { filter: "recent" });
    expect(recent[0].title).toBe("Toute nouvelle cause");
    expect(recent).toHaveLength(8);
  });

  it("searches titles", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const found = await listAll(client, { query: "lait" });
    expect(found.map((c) => c.title)).toEqual(["Lait infantile pour 32 nourrissons"]);
    expect(await listAll(client, { query: "lait", category: "Santé" })).toEqual([]);
    expect(await listAll(client, { query: "aucun-résultat" })).toEqual([]);
  });

  it("paginates without duplicates or gaps", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const paged = await listAll(client, {}, 2);
    expect(paged).toHaveLength(7);
    expect(new Set(paged.map((c) => c.id)).size).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// causes.featured
// ---------------------------------------------------------------------------

describe("causes.featured", () => {
  it("returns the Coup de cœur, or null once it is no longer listed", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const featured = await client.query(api.causes.featured, {});
    expect(featured?.title).toBe("Trois fauteuils roulants adaptés");

    await t.run((ctx) => ctx.db.patch(featured!.id, { status: "closed" }));
    expect(await client.query(api.causes.featured, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// causes.get
// ---------------------------------------------------------------------------

describe("causes.get", () => {
  it("returns the detail view with similar causes of the same category", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const cause = await causeByTitle(t, "Kits d'hygiène pour 80 détenues");
    const detail = await client.query(api.causes.get, { id: cause._id });

    expect(detail).toMatchObject({
      id: cause._id,
      title: cause.title,
      category: "Santé",
      urgency: "urgent",
      raised: cause.raised,
      goal: cause.goalAmount,
      donorCount: cause.donorCount,
      status: "active",
      featured: false,
      endCondition: { type: cause.endType, deadline: cause.deadline },
      organization: { verified: true, city: "Rufisque, Dakar" },
    });
    expect(detail!.estimatedNet).toBe(computeFee(cause.goalAmount, "mock", 0).net);
    expect(detail!.similar.length).toBeGreaterThan(0);
    expect(detail!.similar.length).toBeLessThanOrEqual(3);
    expect(detail!.similar.map((s) => s.id)).not.toContain(cause._id);
    const similarCategories = await t.run(async (ctx) =>
      Promise.all(detail!.similar.map(async (s) => (await ctx.db.get(s.id))!.category)),
    );
    expect(similarCategories.every((c) => c === "Santé")).toBe(true);
  });

  it("returns null for malformed, unknown, unpublished or hidden causes", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    expect(await client.query(api.causes.get, { id: "not-an-id" })).toBeNull();

    const pending = await insertCause(t, { title: "En modération", status: "pending_review" });
    expect(await client.query(api.causes.get, { id: pending })).toBeNull();

    const deleted = await insertCause(t, { title: "Supprimée", status: "deleted" });
    expect(await client.query(api.causes.get, { id: deleted })).toBeNull();

    const cause = await causeByTitle(t, "Moustiquaires imprégnées");
    await t.run((ctx) => ctx.db.patch(cause.structureId, { suspendedAt: Date.now() }));
    expect(await client.query(api.causes.get, { id: cause._id })).toBeNull();
  });

  it("still shows a closed cause", async () => {
    const t = await seeded();
    const { client } = await as(t, "donor");
    const closed = await insertCause(t, { title: "Terminée", status: "closed" });
    expect((await client.query(api.causes.get, { id: closed }))?.status).toBe("closed");
  });

  it("requires a signed-in donor or moderator", async () => {
    const t = await seeded();
    const cause = await causeByTitle(t, "Moustiquaires imprégnées");
    await expectAppError(t.query(api.causes.get, { id: cause._id }), "UNAUTHENTICATED");
    const { client: hospital } = await as(t, "hospital");
    await expectAppError(hospital.query(api.causes.get, { id: cause._id }), "FORBIDDEN");
  });
});

// ---------------------------------------------------------------------------
// Structure write path: create / update / withdraw / mine
// ---------------------------------------------------------------------------

/** Stores a dummy file and returns its storage id (for banners and récépissés). */
async function storeFile(t: T, type = "image/png", bytes = 1024): Promise<Id<"_storage">> {
  return t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
}

/** A signed-in structure account linked to a structure doc (approved by default). */
async function asStructure(
  t: T,
  opts: { status?: Doc<"structures">["status"]; suspended?: boolean } = {},
) {
  const receiptFileId = await storeFile(t, "application/pdf");
  const structureId = await t.run((ctx) =>
    ctx.db.insert("structures", {
      name: "Foyer Test",
      type: "Foyer",
      region: "Dakar",
      commune: "Dakar-Plateau",
      contactName: "Awa Diop",
      phone: "+221770000000",
      email: "foyer@example.sn",
      receiptFileId,
      status: opts.status ?? "approved",
      onboardingPhase: 1,
      createdAt: Date.now(),
      ...(opts.suspended ? { suspendedAt: Date.now() } : {}),
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

/** A valid create payload with a fresh banner. */
async function createArgs(t: T, overrides: Record<string, unknown> = {}) {
  const bannerFileId = await storeFile(t);
  return {
    title: "Réfection du dortoir",
    description: "Nous devons refaire la toiture du dortoir avant la saison des pluies.",
    category: "Matériel" as const,
    bannerFileId,
    endType: "goal" as const,
    goalAmount: 500000,
    deadline: Date.now() + 10 * DAY_MS,
    urgency: "normal" as const,
    ...overrides,
  };
}

describe("causes.create", () => {
  it("refuses non-structures and unapproved or suspended structures", async () => {
    const t = await seeded();
    const { client: donor } = await as(t, "donor");
    await expectAppError(donor.mutation(api.causes.create, await createArgs(t)), "FORBIDDEN");

    const pending = await asStructure(t, { status: "pending" });
    await expectAppError(
      pending.client.mutation(api.causes.create, await createArgs(t)),
      "FORBIDDEN",
    );

    const suspended = await asStructure(t, { suspended: true });
    await expectAppError(
      suspended.client.mutation(api.causes.create, await createArgs(t)),
      "FORBIDDEN",
    );
  });

  it("validates title, goal, deadline window and banner", async () => {
    const t = await seeded();
    const { client } = await asStructure(t);
    await expectAppError(
      client.mutation(api.causes.create, await createArgs(t, { title: "ab" })),
      "VALIDATION",
    );
    await expectAppError(
      client.mutation(api.causes.create, await createArgs(t, { goalAmount: 0 })),
      "VALIDATION",
    );
    await expectAppError(
      client.mutation(api.causes.create, await createArgs(t, { deadline: Date.now() + 40 * DAY_MS })),
      "VALIDATION",
    );
    const badBanner = await storeFile(t, "text/plain");
    await expectAppError(
      client.mutation(api.causes.create, await createArgs(t, { bannerFileId: badBanner })),
      "VALIDATION",
    );
  });

  it("creates a pending_review cause owned by the structure and logs it", async () => {
    const t = await seeded();
    const { client, structureId, userId } = await asStructure(t);
    const { id, status } = await client.mutation(api.causes.create, await createArgs(t));
    expect(status).toBe("pending_review");

    const cause = await t.run((ctx) => ctx.db.get(id));
    expect(cause).toMatchObject({ structureId, status: "pending_review", raised: 0, donorCount: 0 });

    const mine = await client.query(api.causes.mine, {});
    expect(mine.map((c) => c.id)).toContain(id);

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_target", (q) => q.eq("targetTable", "causes").eq("targetId", id))
        .collect(),
    );
    expect(audit.some((a) => a.action === "cause.create" && a.actorId === userId)).toBe(true);
  });
});

describe("causes.update", () => {
  it("edits a refused cause and sends it back to moderation, clearing the reason", async () => {
    const t = await seeded();
    const { client } = await asStructure(t);
    const { id } = await client.mutation(api.causes.create, await createArgs(t));
    await t.run((ctx) => ctx.db.patch(id, { status: "refused", refusalReason: "Devis manquant" }));

    await client.mutation(api.causes.update, { causeId: id, title: "Réfection complète" });
    const cause = await t.run((ctx) => ctx.db.get(id));
    expect(cause).toMatchObject({ status: "pending_review", title: "Réfection complète" });
    expect(cause!.refusalReason).toBeUndefined();
  });

  it("refuses editing an active cause (G7 deferred) and non-owners", async () => {
    const t = await seeded();
    const owner = await asStructure(t);
    const { id } = await owner.client.mutation(api.causes.create, await createArgs(t));
    await t.run((ctx) => ctx.db.patch(id, { status: "active" }));
    await expectAppError(
      owner.client.mutation(api.causes.update, { causeId: id, description: "x".repeat(30) }),
      "CONFLICT",
    );

    await t.run((ctx) => ctx.db.patch(id, { status: "pending_review" }));
    const other = await asStructure(t);
    await expectAppError(
      other.client.mutation(api.causes.update, { causeId: id, title: "pirate" }),
      "FORBIDDEN",
    );
  });
});

describe("causes.withdraw", () => {
  it("withdraws a cause in moderation", async () => {
    const t = await seeded();
    const { client } = await asStructure(t);
    const { id } = await client.mutation(api.causes.create, await createArgs(t));
    await client.mutation(api.causes.withdraw, { causeId: id });
    expect((await t.run((ctx) => ctx.db.get(id)))!.status).toBe("withdrawn");
  });

  it("refuses to withdraw an active cause that has donations", async () => {
    const t = await seeded();
    const { client } = await asStructure(t);
    const { id } = await client.mutation(api.causes.create, await createArgs(t));
    await t.run(async (ctx) => {
      await ctx.db.patch(id, { status: "active", raised: 10000, donorCount: 1 });
      const donor = await ctx.db.insert("users", {
        name: "Donor",
        role: "donor",
        disabled: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("donations", {
        causeId: id,
        donorId: donor,
        amount: 10000,
        fee: 300,
        platformFee: 0,
        net: 9700,
        method: "wave",
        provider: "mock",
        status: "held",
        createdAt: Date.now(),
      });
    });
    await expectAppError(client.mutation(api.causes.withdraw, { causeId: id }), "CONFLICT");
  });

  it("refuses withdraw and flags not-withdrawable when a pending donation exists but donorCount is 0", async () => {
    const t = await seeded();
    const { client } = await asStructure(t);
    const { id } = await client.mutation(api.causes.create, await createArgs(t));
    await t.run(async (ctx) => {
      // Active, no counted donors, but an in-flight payment row exists (may still settle).
      await ctx.db.patch(id, { status: "active", raised: 0, donorCount: 0 });
      const donor = await ctx.db.insert("users", {
        name: "Donor",
        role: "donor",
        disabled: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("donations", {
        causeId: id,
        donorId: donor,
        amount: 10000,
        fee: 300,
        platformFee: 0,
        net: 9700,
        method: "wave",
        provider: "mock",
        status: "pending",
        createdAt: Date.now(),
      });
    });
    const mine = await client.query(api.causes.mine, {});
    expect(mine.find((c) => c.id === id)!.withdrawable).toBe(false);
    await expectAppError(client.mutation(api.causes.withdraw, { causeId: id }), "CONFLICT");
  });
});

describe("causes.mine", () => {
  it("returns only the structure's own causes, newest first, without deleted ones", async () => {
    const t = await seeded();
    const { client } = await asStructure(t);
    const first = await client.mutation(api.causes.create, await createArgs(t, { title: "Première" }));
    const second = await client.mutation(
      api.causes.create,
      await createArgs(t, { title: "Deuxième" }),
    );
    await t.run((ctx) => ctx.db.patch(first.id, { status: "deleted" }));

    const mine = await client.query(api.causes.mine, {});
    expect(mine.map((c) => c.title)).toEqual(["Deuxième"]);
    expect(mine[0].id).toBe(second.id);

    // Another structure sees none of these.
    const other = await asStructure(t);
    expect(await other.client.query(api.causes.mine, {})).toEqual([]);
  });
});
