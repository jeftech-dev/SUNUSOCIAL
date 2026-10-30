// Moderation decisions. Every function requires a moderator whose session passed the SMS code.
// Sprint 3: the weekly "Coup de cœur" (DB-6). The queues and decisions come in Sprint 5.

import { v } from "convex/values";

import { percentOf } from "../lib/causes";
import { fr } from "../lib/strings.fr";
import type { Category } from "../lib/types";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logAudit } from "./audit";
import { isListed, structureLoader } from "./lib/causeViews";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";

/** Most causes offered by the picker. Active causes last ≤ 30 days, so this is generous. */
const MAX_CANDIDATES = 200;

export interface FeaturedCandidate {
  id: Id<"causes">;
  title: string;
  organization: string;
  category: Category;
  percent: number;
  urgent: boolean;
  featured: boolean;
}

/** The causes a moderator can pick as Coup de cœur: every listed cause, soonest deadline first. */
export const featuredCandidates = query({
  args: {},
  handler: async (ctx): Promise<FeaturedCandidate[]> => {
    await requireRole(ctx, "moderator");
    const active = await ctx.db
      .query("causes")
      .withIndex("by_status_deadline", (q) => q.eq("status", "active"))
      .take(MAX_CANDIDATES);
    const structureOf = structureLoader(ctx);
    const candidates: FeaturedCandidate[] = [];
    for (const cause of active) {
      const structure = await structureOf(cause.structureId);
      if (!isListed(cause, structure) || !structure) continue;
      candidates.push({
        id: cause._id,
        title: cause.title,
        organization: structure.name,
        category: cause.category,
        percent: percentOf(cause.raised, cause.goalAmount),
        urgent: cause.urgency === "urgent",
        featured: cause.featuredAt !== undefined,
      });
    }
    return candidates;
  },
});

/**
 * Picks the Coup de cœur de la semaine, replacing the current one, or clears it with `null`.
 * Only one cause is featured at a time (DB-6). It stays until replaced or removed.
 */
export const setFeatured = mutation({
  args: { causeId: v.union(v.id("causes"), v.null()) },
  handler: async (ctx, { causeId }): Promise<{ ok: true; message: string }> => {
    const { user } = await requireRole(ctx, "moderator");

    const cause = causeId === null ? null : await ctx.db.get(causeId);
    if (causeId !== null) {
      const structure = cause && (await ctx.db.get(cause.structureId));
      if (!cause || !isListed(cause, structure)) {
        throw appError("VALIDATION", fr.errors.causeNotEligible, "causeId");
      }
    }

    const current = await ctx.db
      .query("causes")
      .withIndex("by_featured", (q) => q.gt("featuredAt", 0))
      .collect();
    for (const previous of current) {
      if (previous._id !== causeId) await ctx.db.patch(previous._id, { featuredAt: undefined });
    }
    const previousIds = current.map((c) => c._id);

    if (cause) {
      await ctx.db.patch(cause._id, { featuredAt: Date.now() });
      await logAudit(ctx, {
        actorId: user._id,
        action: "featured.set",
        targetTable: "causes",
        targetId: cause._id,
        details: { previous: previousIds },
      });
      return { ok: true, message: fr.featuredPicker.setDone(cause.title) };
    }

    for (const previousId of previousIds) {
      await logAudit(ctx, {
        actorId: user._id,
        action: "featured.clear",
        targetTable: "causes",
        targetId: previousId,
      });
    }
    return { ok: true, message: fr.featuredPicker.clearDone };
  },
});
