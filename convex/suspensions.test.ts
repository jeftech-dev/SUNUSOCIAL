/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import { fr } from "../lib/strings.fr";
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

async function client(t: T, role: "moderator" | "structure", structureId?: Id<"structures">) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: role === "moderator" ? "Mod" : "Awa Diop",
      role,
      phone: role === "structure" ? "+221770000001" : undefined,
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
  return { userId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

/** An approved structure with a released cause whose proof deadline passed `daysLate` days ago. */
async function lateStructure(t: T, daysLate = 1) {
  return t.run(async (ctx) => {
    const file = await ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" }));
    const structureId = await ctx.db.insert("structures", {
      name: "Foyer Jàmm",
      type: "Foyer",
      region: "Dakar",
      commune: "Rufisque",
      contactName: "Awa Diop",
      phone: "+221770000001",
      email: "jamm@example.sn",
      receiptFileId: file,
      status: "approved",
      onboardingPhase: 1,
      createdAt: Date.now(),
    });
    const causeId = await ctx.db.insert("causes", {
      structureId,
      title: "Riz et huile",
      description: "Distribution alimentaire de novembre.",
      category: "Alimentation",
      bannerFileId: file,
      endType: "goal",
      goalAmount: 100000,
      deadline: Date.now() - 8 * DAY_MS,
      extensionCount: 0,
      urgency: "normal",
      raised: 100000,
      donorCount: 3,
      status: "closed",
      submittedAt: Date.now() - 20 * DAY_MS,
      fundsReleasedAt: Date.now() - 8 * DAY_MS,
    });
    const deadlineId = await ctx.db.insert("proofDeadlines", {
      causeId,
      structureId,
      reason: "release",
      dueAt: Date.now() - daysLate * DAY_MS,
      enforced: true,
    });
    return { structureId, causeId, deadlineId };
  });
}

const auditActions = (t: T, structureId: Id<"structures">) =>
  t.run(async (ctx) =>
    (
      await ctx.db
        .query("auditLog")
        .withIndex("by_target", (q) =>
          q.eq("targetTable", "structures").eq("targetId", structureId),
        )
        .collect()
    ).map((a) => a.action),
  );

describe("suspensions (S26)", () => {
  it("lists a suspended structure with its late proof, for moderators only", async () => {
    const t = setup();
    const { structureId } = await lateStructure(t);
    const mod = await client(t, "moderator");
    const owner = await client(t, "structure", structureId);
    expect(await mod.client.query(api.suspensions.list, {})).toEqual([]);

    await t.mutation(internal.payments.enforceProofDeadlines, {});
    const [row] = await mod.client.query(api.suspensions.list, {});
    expect(row).toMatchObject({
      id: structureId,
      organization: "Foyer Jàmm",
      lateProofs: [{ cause: "Riz et huile", proofStatus: null }],
    });
    await expectAppError(owner.client.query(api.suspensions.list, {}), "FORBIDDEN");
    await expectAppError(owner.client.mutation(api.suspensions.lift, { structureId }), "FORBIDDEN");
  });

  it("refuses to lift while a proof is overdue, then lifts once the deadline is settled", async () => {
    const t = setup();
    const { structureId, deadlineId } = await lateStructure(t);
    const mod = await client(t, "moderator");
    const owner = await client(t, "structure", structureId);
    await expectAppError(mod.client.mutation(api.suspensions.lift, { structureId }), "CONFLICT");

    await t.mutation(internal.payments.enforceProofDeadlines, {});
    await expectAppError(mod.client.mutation(api.suspensions.lift, { structureId }), "CONFLICT");
    expect((await t.run((ctx) => ctx.db.get(structureId)))!.suspendedAt).toBeDefined();

    // The late proof is validated (or a delay is granted): the deadline is no longer overdue.
    await t.run((ctx) => ctx.db.patch(deadlineId, { metAt: Date.now() }));
    await mod.client.mutation(api.suspensions.lift, { structureId });
    expect((await t.run((ctx) => ctx.db.get(structureId)))!.suspendedAt).toBeUndefined();
    expect(await auditActions(t, structureId)).toContain("structure.unsuspend");
    const notes = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) => q.eq("userId", owner.userId))
        .collect(),
    );
    expect(notes.map((n) => n.kind)).toContain("account_suspended");

    // The cron does not suspend it again.
    expect(await t.mutation(internal.payments.enforceProofDeadlines, {})).toEqual({ suspended: 0 });
  });

  it("reminds the responsible of the missed due date and logs it", async () => {
    const t = setup();
    const { structureId, deadlineId } = await lateStructure(t, 2);
    const mod = await client(t, "moderator");
    const owner = await client(t, "structure", structureId);
    await t.mutation(internal.payments.enforceProofDeadlines, {});

    await mod.client.mutation(api.suspensions.remind, { structureId });
    const notes = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) => q.eq("userId", owner.userId))
        .collect(),
    );
    // The suspension notice, then the reminder.
    expect(notes).toHaveLength(2);
    expect(notes.some((n) => n.title === fr.notifications.proofReminderTitle)).toBe(true);
    expect(await auditActions(t, structureId)).toContain("structure.remind");

    await t.run((ctx) => ctx.db.patch(deadlineId, { metAt: Date.now() }));
    await expectAppError(mod.client.mutation(api.suspensions.remind, { structureId }), "CONFLICT");
  });

  it("refuses a second reminder within the cooldown", async () => {
    const t = setup();
    const { structureId } = await lateStructure(t, 2);
    const mod = await client(t, "moderator");
    const owner = await client(t, "structure", structureId);
    await t.mutation(internal.payments.enforceProofDeadlines, {});

    await mod.client.mutation(api.suspensions.remind, { structureId });
    await expectAppError(mod.client.mutation(api.suspensions.remind, { structureId }), "CONFLICT");
    const notes = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) => q.eq("userId", owner.userId))
        .collect(),
    );
    expect(notes.filter((n) => n.title === fr.notifications.proofReminderTitle)).toHaveLength(1);
  });
});
