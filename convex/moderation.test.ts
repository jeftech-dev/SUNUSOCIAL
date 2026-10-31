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
