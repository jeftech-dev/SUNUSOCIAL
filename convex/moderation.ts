// Moderation decisions. Every function requires a moderator whose session passed the SMS code.
// Sprint 3: the weekly "Coup de cœur" (DB-6). The queues and decisions come in Sprint 5.

import { v } from "convex/values";

import { percentOf } from "../lib/causes";
import { fr } from "../lib/strings.fr";
import type { Category, ModerationQueues } from "../lib/types";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx, query } from "./_generated/server";
import { logAudit } from "./audit";
import { isListed, structureLoader } from "./lib/causeViews";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { notifyUser } from "./notify";

/** Most causes offered by the picker. Active causes last ≤ 30 days, so this is generous. */
const MAX_CANDIDATES = 200;
/** Most rows shown per moderation queue. */
const MAX_QUEUE = 50;

const decisionV = v.union(v.literal("approve"), v.literal("refuse"));

/** The responsible account of a structure/hospital, for decision notifications. */
function structureUser(ctx: MutationCtx, structureId: Id<"structures">): Promise<Doc<"users"> | null> {
  return ctx.db
    .query("users")
    .withIndex("by_structure", (q) => q.eq("structureId", structureId))
    .first();
}

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

// ---------------------------------------------------------------------------
// Queues + decisions (Sprint 5, tasks 5–6). Every function requires a moderator.
// ---------------------------------------------------------------------------

/** All the pending work: structures, causes and proofs. Deletions/refunds/payouts: Sprint 6. */
export const queues = query({
  args: {},
  handler: async (ctx): Promise<ModerationQueues> => {
    await requireRole(ctx, "moderator");

    const structures = await ctx.db
      .query("structures")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(MAX_QUEUE);
    const causes = await ctx.db
      .query("causes")
      .withIndex("by_status_deadline", (q) => q.eq("status", "pending_review"))
      .take(MAX_QUEUE);
    const submitted = await ctx.db
      .query("proofs")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .take(MAX_QUEUE);

    const structureOf = structureLoader(ctx);
    const causeItems = [];
    for (const cause of causes) {
      const structure = await structureOf(cause.structureId);
      causeItems.push({
        id: cause._id,
        title: cause.title,
        organization: structure?.name ?? "",
        urgent: cause.urgency === "urgent",
      });
    }

    const proofItems = [];
    for (const proof of submitted) {
      const cause = await ctx.db.get(proof.causeId);
      const items = await ctx.db
        .query("proofItems")
        .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
        .collect();
      proofItems.push({
        id: proof._id,
        cause: cause?.title ?? "",
        flagged: proof.dossierFlags.length > 0 || items.some((i) => i.flagged),
      });
    }

    const featured = await ctx.db
      .query("causes")
      .withIndex("by_featured", (q) => q.gt("featuredAt", 0))
      .first();

    return {
      structures: {
        count: structures.length,
        items: structures.map((s) => ({
          id: s._id,
          name: s.name,
          type: s.type,
          region: s.region,
          submittedAt: s.createdAt,
          hasPayout: s.payout !== undefined,
        })),
      },
      causes: { count: causeItems.length, items: causeItems },
      proofs: { count: proofItems.length, items: proofItems },
      deletions: { count: 0, items: [] },
      refunds: { count: 0, items: [] },
      payoutChanges: { count: 0, items: [] },
      featured:
        featured?.featuredAt !== undefined
          ? { causeId: featured._id, since: featured.featuredAt }
          : null,
    };
  },
});

/** Approve or refuse a structure's documents and payout account together (DB-3). */
export const decideStructure = mutation({
  args: { structureId: v.id("structures"), decision: decisionV, reason: v.optional(v.string()) },
  handler: async (ctx, { structureId, decision, reason }): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "moderator");
    const structure = await ctx.db.get(structureId);
    if (!structure) throw appError("NOT_FOUND", fr.errors.generic, "structureId");
    const trimmed = reason?.trim();
    if (decision === "refuse" && !trimmed) {
      throw appError("VALIDATION", fr.moderation.refuseReasonRequired, "reason");
    }

    if (decision === "approve") {
      const patch: Partial<Doc<"structures">> = { status: "approved", refusalReason: undefined };
      if (structure.payout && structure.payout.verifiedAt === undefined) {
        patch.payout = { ...structure.payout, verifiedAt: Date.now(), verifiedBy: user._id };
      }
      await ctx.db.patch(structureId, patch);
    } else {
      await ctx.db.patch(structureId, { status: "refused", refusalReason: trimmed });
    }

    await logAudit(ctx, {
      actorId: user._id,
      action: decision === "approve" ? "structure.approve" : "structure.refuse",
      targetTable: "structures",
      targetId: structureId,
      details: trimmed ? { reason: trimmed } : undefined,
    });

    const responsible = await structureUser(ctx, structureId);
    if (responsible) {
      await notifyUser(ctx, {
        userId: responsible._id,
        kind: "structure_decision",
        title:
          decision === "approve"
            ? fr.notifications.structureApprovedTitle
            : fr.notifications.structureRefusedTitle,
        body:
          decision === "approve"
            ? fr.notifications.structureApprovedBody
            : fr.notifications.structureRefusedBody(trimmed!),
      });
    }
    return { ok: true };
  },
});

/** Approve (→ active) or refuse (→ refused, reason required) a cause in moderation. */
export const decideCause = mutation({
  args: { causeId: v.id("causes"), decision: decisionV, reason: v.optional(v.string()) },
  handler: async (ctx, { causeId, decision, reason }): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "moderator");
    const cause = await ctx.db.get(causeId);
    if (!cause) throw appError("NOT_FOUND", fr.errors.causeNotFound, "causeId");
    if (cause.status !== "pending_review") {
      throw appError("CONFLICT", fr.errors.causeNotEditable, "causeId");
    }
    const trimmed = reason?.trim();
    if (decision === "refuse" && !trimmed) {
      throw appError("VALIDATION", fr.moderation.refuseReasonRequired, "reason");
    }

    if (decision === "approve") {
      await ctx.db.patch(causeId, {
        status: "active",
        approvedAt: Date.now(),
        refusalReason: undefined,
      });
    } else {
      await ctx.db.patch(causeId, { status: "refused", refusalReason: trimmed });
    }

    await logAudit(ctx, {
      actorId: user._id,
      action: decision === "approve" ? "cause.approve" : "cause.refuse",
      targetTable: "causes",
      targetId: causeId,
      details: trimmed ? { reason: trimmed } : undefined,
    });

    const responsible = await structureUser(ctx, cause.structureId);
    if (responsible) {
      await notifyUser(ctx, {
        userId: responsible._id,
        kind: "cause_decision",
        title:
          decision === "approve"
            ? fr.notifications.causeApprovedTitle
            : fr.notifications.causeRefusedTitle,
        body:
          decision === "approve"
            ? fr.notifications.causeApprovedBody(cause.title)
            : fr.notifications.causeRefusedBody(cause.title, trimmed!),
        link: `/structure`,
      });
    }
    return { ok: true };
  },
});

/**
 * Validate a dossier (→ visible to donors and the public) or escalate it for completion.
 * Escalation (G8 interim: the structure completes and resends within 3 days) only records the
 * request and notifies the structure here; the resubmission flow is deferred.
 */
export const decideProof = mutation({
  args: {
    proofId: v.id("proofs"),
    decision: v.union(v.literal("validate"), v.literal("escalate")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { proofId, decision, reason }): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "moderator");
    const proof = await ctx.db.get(proofId);
    if (!proof) throw appError("NOT_FOUND", fr.errors.generic, "proofId");
    if (proof.status !== "submitted") {
      throw appError("CONFLICT", fr.errors.proofAlreadySubmitted, "proofId");
    }
    const cause = await ctx.db.get(proof.causeId);
    const title = cause?.title ?? "";

    if (decision === "escalate") {
      const trimmed = reason?.trim();
      if (!trimmed) throw appError("VALIDATION", fr.moderation.refuseReasonRequired, "reason");
      await ctx.db.patch(proofId, { status: "escalated" });
      await logAudit(ctx, {
        actorId: user._id,
        action: "proof.escalate",
        targetTable: "proofs",
        targetId: proofId,
        details: { reason: trimmed },
      });
      const responsible = await structureUser(ctx, proof.structureId);
      if (responsible) {
        await notifyUser(ctx, {
          userId: responsible._id,
          kind: "proof_published",
          title: fr.notifications.proofEscalatedTitle,
          body: fr.notifications.proofEscalatedBody(title, trimmed),
        });
      }
      return { ok: true };
    }

    // Validate: publish to donors and the public, mark the proof deadline met.
    await ctx.db.patch(proofId, { status: "validated", validatedAt: Date.now() });
    const deadline = await ctx.db
      .query("proofDeadlines")
      .withIndex("by_cause", (q) => q.eq("causeId", proof.causeId))
      .unique();
    if (deadline && deadline.metAt === undefined) {
      await ctx.db.patch(deadline._id, { metAt: Date.now() });
    }
    await logAudit(ctx, {
      actorId: user._id,
      action: "proof.validate",
      targetTable: "proofs",
      targetId: proofId,
    });

    // Notify the structure, then every donor of the cause (in-app; SMS fan-out: Sprint 7 infra).
    const responsible = await structureUser(ctx, proof.structureId);
    if (responsible) {
      await notifyUser(ctx, {
        userId: responsible._id,
        kind: "proof_published",
        title: fr.notifications.proofValidatedTitle,
        body: fr.notifications.proofValidatedBody(title),
      });
    }
    const donations = await ctx.db
      .query("donations")
      .withIndex("by_cause", (q) => q.eq("causeId", proof.causeId))
      .collect();
    const donorIds = [
      ...new Set(
        donations.filter((d) => d.status === "held" || d.status === "released").map((d) => d.donorId),
      ),
    ];
    for (const donorId of donorIds) {
      await notifyUser(ctx, {
        userId: donorId,
        kind: "proof_published",
        title: fr.notifications.proofPublishedTitle,
        body: fr.notifications.proofPublishedBody(title),
        link: `/causes/${proof.causeId}`,
      });
    }
    return { ok: true };
  },
});
