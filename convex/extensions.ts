// Extension requests (DB-11, DB-12, DT-30): a structure asks to push back a cause deadline or a
// proof deadline. Each request can extend by at most MAX_EXTENSION_DAYS and is decided by a
// moderator (moderation.decideExtension), who notifies the cause's donors when a cause is extended.

import { v } from "convex/values";

import { DAY_MS, loadConfig } from "../lib/config";
import { fr } from "../lib/strings.fr";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { logAudit } from "./audit";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { extensionKindV } from "./validators";

/**
 * Requests an extension of a cause deadline or a proof deadline (S14). The new date must be in the
 * future and at most MAX_EXTENSION_DAYS beyond the current one. Ownership is enforced server-side.
 */
export const request = mutation({
  args: {
    kind: extensionKindV,
    targetId: v.string(),
    requestedUntil: v.number(),
    reason: v.string(),
  },
  handler: async (
    ctx,
    { kind, targetId, requestedUntil, reason },
  ): Promise<{ requestId: Id<"extensionRequests"> }> => {
    const { user } = await requireRole(ctx, "structure", "hospital");
    if (!user.structureId) throw appError("FORBIDDEN", fr.errors.forbidden);
    const trimmed = reason.trim();
    if (!trimmed) throw appError("VALIDATION", fr.errors.extensionReasonRequired, "reason");
    const maxDays = loadConfig(process.env).maxExtensionDays;
    const now = Date.now();

    let current: number;
    if (kind === "cause_deadline") {
      const causeId = ctx.db.normalizeId("causes", targetId);
      const cause = causeId && (await ctx.db.get(causeId));
      if (!cause || cause.structureId !== user.structureId) {
        throw appError("FORBIDDEN", fr.errors.forbidden, "targetId");
      }
      if (cause.status !== "active") {
        throw appError("CONFLICT", fr.errors.extensionNotAllowed, "targetId");
      }
      current = cause.deadline;
    } else {
      const deadlineId = ctx.db.normalizeId("proofDeadlines", targetId);
      const deadline = deadlineId && (await ctx.db.get(deadlineId));
      if (!deadline || deadline.structureId !== user.structureId) {
        throw appError("FORBIDDEN", fr.errors.forbidden, "targetId");
      }
      if (deadline.metAt !== undefined) {
        throw appError("CONFLICT", fr.errors.extensionNotAllowed, "targetId");
      }
      current = deadline.dueAt;
    }

    if (requestedUntil <= now || requestedUntil <= current) {
      throw appError("VALIDATION", fr.errors.extensionDateInvalid(maxDays), "requestedUntil");
    }
    if (requestedUntil > current + maxDays * DAY_MS) {
      throw appError("VALIDATION", fr.errors.extensionDateInvalid(maxDays), "requestedUntil");
    }

    const requestId = await ctx.db.insert("extensionRequests", {
      kind,
      targetId,
      structureId: user.structureId,
      requestedUntil,
      reason: trimmed,
      status: "pending",
      createdAt: now,
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "extension.request",
      targetTable: "extensionRequests",
      targetId: requestId,
      details: { kind, target: targetId, requestedUntil },
    });
    return { requestId };
  },
});
