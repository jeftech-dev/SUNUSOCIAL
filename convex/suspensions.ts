// Suspended structures (PARCOURS S26, DB-12, DT-25): the moderator's follow-up of late proofs.
// The hourly cron suspends (payments.enforceProofDeadlines); a moderator reminds the structure and
// lifts the suspension once no proof is overdue any more (validated, or a delay was granted).

import { v } from "convex/values";

import { formatDate } from "../lib/dates";
import { fr } from "../lib/strings.fr";
import type { SuspendedStructureItem } from "../lib/types";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { logAudit } from "./audit";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { notifyUser } from "./notify";

/** Minimum delay between two reminders to the same structure. */
const REMIND_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Enforced proof deadlines of a structure that are past due and still unmet. */
async function overdueDeadlines(
  ctx: QueryCtx,
  structureId: Id<"structures">,
  now: number,
): Promise<Doc<"proofDeadlines">[]> {
  const deadlines = await ctx.db
    .query("proofDeadlines")
    .withIndex("by_structure", (q) => q.eq("structureId", structureId))
    .collect();
  return deadlines.filter((d) => d.enforced && d.metAt === undefined && d.dueAt < now);
}

async function suspendedStructure(
  ctx: MutationCtx,
  structureId: Id<"structures">,
): Promise<Doc<"structures">> {
  const structure = await ctx.db.get(structureId);
  if (!structure) throw appError("NOT_FOUND", fr.errors.generic, "structureId");
  if (structure.suspendedAt === undefined) {
    throw appError("CONFLICT", fr.errors.notSuspended, "structureId");
  }
  return structure;
}

/** Every suspended structure with the late proofs that caused it, oldest suspension first. */
export const list = query({
  args: {},
  handler: async (ctx): Promise<SuspendedStructureItem[]> => {
    await requireRole(ctx, "moderator");
    // Only approved structures get suspended, and their number stays small enough to scan: there
    // is no index on the optional `suspendedAt`.
    const approved = await ctx.db
      .query("structures")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const suspended = approved
      .filter((s) => s.suspendedAt !== undefined)
      .sort((a, b) => a.suspendedAt! - b.suspendedAt!);
    const now = Date.now();
    return Promise.all(
      suspended.map(async (structure) => {
        const overdue = await overdueDeadlines(ctx, structure._id, now);
        const lateProofs = await Promise.all(
          overdue.map(async (deadline) => {
            const [cause, proof] = await Promise.all([
              ctx.db.get(deadline.causeId),
              ctx.db
                .query("proofs")
                .withIndex("by_cause", (q) => q.eq("causeId", deadline.causeId))
                .unique(),
            ]);
            return {
              cause: cause?.title ?? "",
              dueAt: deadline.dueAt,
              proofStatus: proof?.status ?? null,
            };
          }),
        );
        return {
          id: structure._id,
          organization: structure.name,
          suspendedAt: structure.suspendedAt!,
          lateProofs,
        };
      }),
    );
  },
});

/** "Relancer la structure": an in-app reminder plus an SMS with the missed due date (S26). */
export const remind = mutation({
  args: { structureId: v.id("structures") },
  handler: async (ctx, { structureId }): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "moderator");
    const structure = await suspendedStructure(ctx, structureId);
    const overdue = await overdueDeadlines(ctx, structureId, Date.now());
    if (overdue.length === 0) throw appError("CONFLICT", fr.errors.noLateProof, "structureId");
    // One reminder per cooldown: a double click or several moderators must not spam the SMS.
    const previous = await ctx.db
      .query("auditLog")
      .withIndex("by_target", (q) => q.eq("targetTable", "structures").eq("targetId", structureId))
      .order("desc")
      .take(20);
    const since = Date.now() - REMIND_COOLDOWN_MS;
    if (previous.some((row) => row.action === "structure.remind" && row.createdAt > since)) {
      throw appError("CONFLICT", fr.errors.reminderTooSoon, "structureId");
    }
    const oldest = overdue.reduce((a, b) => (a.dueAt <= b.dueAt ? a : b));
    const cause = await ctx.db.get(oldest.causeId);
    const title = cause?.title ?? structure.name;
    const due = formatDate(oldest.dueAt);
    const responsible = await ctx.db
      .query("users")
      .withIndex("by_structure", (q) => q.eq("structureId", structureId))
      .first();
    if (responsible) {
      await notifyUser(ctx, {
        userId: responsible._id,
        kind: "account_suspended",
        title: fr.notifications.proofReminderTitle,
        body: fr.notifications.proofReminderBody(title, due),
        link: "/structure",
        sms: fr.sms.proofReminder(title, due),
      });
    }
    await logAudit(ctx, {
      actorId: user._id,
      action: "structure.remind",
      targetTable: "structures",
      targetId: structureId,
      details: { causeId: oldest.causeId, dueAt: oldest.dueAt },
    });
    return { ok: true };
  },
});

/**
 * "Lever la suspension" (DT-25). Refused while a proof is still overdue: the hourly cron would
 * suspend the structure again at once. The moderator first validates the late proof or grants a
 * delay, which is what settles the deadline.
 */
export const lift = mutation({
  args: { structureId: v.id("structures") },
  handler: async (ctx, { structureId }): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "moderator");
    const structure = await suspendedStructure(ctx, structureId);
    const overdue = await overdueDeadlines(ctx, structureId, Date.now());
    if (overdue.length > 0) throw appError("CONFLICT", fr.errors.proofStillLate, "structureId");
    await ctx.db.patch(structureId, { suspendedAt: undefined });
    await logAudit(ctx, {
      actorId: user._id,
      action: "structure.unsuspend",
      targetTable: "structures",
      targetId: structureId,
      details: { suspendedAt: structure.suspendedAt },
    });
    const responsible = await ctx.db
      .query("users")
      .withIndex("by_structure", (q) => q.eq("structureId", structureId))
      .first();
    if (responsible) {
      await notifyUser(ctx, {
        userId: responsible._id,
        kind: "account_suspended",
        title: fr.notifications.suspensionLiftedTitle,
        body: fr.notifications.suspensionLiftedBody,
        link: "/structure",
        sms: fr.sms.suspensionLifted(structure.name),
      });
    }
    return { ok: true };
  },
});
