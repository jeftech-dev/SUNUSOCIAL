// Causes: the donor read path (feed, Coup de cœur, detail). Spec: docs/API_CONTRACT.md "Causes".
// Only active causes from verified structures are listed (DT-34).

import { paginationOptsValidator, type OrderedQuery } from "convex/server";
import { v } from "convex/values";

import { ALMOST_REACHED_PERCENT, endConditionOf, percentOf } from "../lib/causes";
import { DAY_MS, loadConfig } from "../lib/config";
import { computeFee } from "../lib/money";
import { fr } from "../lib/strings.fr";
import {
  CAUSE_FILTERS,
  type CauseCardView,
  type CauseDetailView,
  type CauseFilter,
  type CauseStatus,
  type Category,
  type OwnedCauseView,
  type StructureCauseView,
} from "../lib/types";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { logAudit } from "./audit";
import { validateUpload } from "./files";
import { isListed, isVerified, structureLoader, toCardView, toSimilarView } from "./lib/causeViews";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { categoryV, endTypeV, literals, urgencyV } from "./validators";

const TITLE_MIN = 4;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 20;

/** Largest feed page a client may ask for. */
export const MAX_PAGE_SIZE = 48;
/** Longest search text kept; Convex search also caps the number of terms. */
const MAX_SEARCH_LENGTH = 100;
const SIMILAR_COUNT = 3;
/** Same-category causes read to find SIMILAR_COUNT listed ones. */
const SIMILAR_SCAN = 24;

type CausesQuery = OrderedQuery<DataModel["causes"]>;

/**
 * The active causes matching the filters, before the structure check.
 * Order: soonest deadline first; newest approval first for "recent"; relevance when searching.
 */
function feedQuery(
  ctx: QueryCtx,
  args: { category?: Category; filter?: CauseFilter; text: string },
): CausesQuery {
  const { category, filter, text } = args;
  const causes = ctx.db.query("causes");
  let ordered: CausesQuery;
  if (text) {
    ordered = causes.withSearchIndex("search_title", (q) => {
      const active = q.search("title", text).eq("status", "active");
      const inCategory = category ? active.eq("category", category) : active;
      return filter === "urgent" ? inCategory.eq("urgency", "urgent") : inCategory;
    });
  } else if (filter === "recent") {
    ordered = (
      category
        ? causes.withIndex("by_status_category_approved", (q) =>
            q.eq("status", "active").eq("category", category),
          )
        : causes.withIndex("by_status_approved", (q) => q.eq("status", "active"))
    ).order("desc");
  } else {
    ordered = (
      category
        ? causes.withIndex("by_status_category_deadline", (q) =>
            q.eq("status", "active").eq("category", category),
          )
        : causes.withIndex("by_status_deadline", (q) => q.eq("status", "active"))
    ).order("asc");
  }

  if (filter === "urgent" && !text) {
    ordered = ordered.filter((q) => q.eq(q.field("urgency"), "urgent"));
  }
  if (filter === "almost") {
    ordered = ordered.filter((q) =>
      q.gte(q.mul(q.field("raised"), 100), q.mul(q.field("goalAmount"), ALMOST_REACHED_PERCENT)),
    );
  }
  return ordered;
}

/** The causes feed, paginated for `usePaginatedQuery`. */
export const list = query({
  args: {
    category: v.optional(categoryV),
    filter: v.optional(literals(CAUSE_FILTERS)),
    query: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "donor", "moderator");
    const text = (args.query ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
    const result = await feedQuery(ctx, {
      category: args.category,
      filter: args.filter,
      text,
    }).paginate({
      ...args.paginationOpts,
      numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), MAX_PAGE_SIZE),
    });

    // A page can come back shorter than asked when a structure is no longer verified.
    const structureOf = structureLoader(ctx);
    const page: CauseCardView[] = [];
    for (const cause of result.page) {
      const structure = await structureOf(cause.structureId);
      if (isListed(cause, structure) && structure) {
        page.push(await toCardView(ctx, cause, structure));
      }
    }
    return { ...result, page };
  },
});

/** The "Coup de cœur de la semaine" (DB-6), or null when none is set. */
export const featured = query({
  args: {},
  handler: async (ctx): Promise<CauseCardView | null> => {
    await requireRole(ctx, "donor", "moderator");
    const cause = await ctx.db
      .query("causes")
      .withIndex("by_featured", (q) => q.gt("featuredAt", 0))
      .order("desc")
      .first();
    if (!cause) return null;
    const structure = await ctx.db.get(cause.structureId);
    if (!isListed(cause, structure) || !structure) return null;
    return toCardView(ctx, cause, structure);
  },
});

/**
 * One cause, or null when it doesn't exist or isn't visible: an active or closed cause of a
 * verified structure. Takes a string so a malformed id in the URL is "not found", not a crash.
 */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args): Promise<CauseDetailView | null> => {
    await requireRole(ctx, "donor", "moderator");
    const id = ctx.db.normalizeId("causes", args.id);
    const cause = id && (await ctx.db.get(id));
    if (!cause || (cause.status !== "active" && cause.status !== "closed")) return null;
    const structure = await ctx.db.get(cause.structureId);
    if (!isVerified(structure)) return null;

    const structureOf = structureLoader(ctx);
    const sameCategory = await ctx.db
      .query("causes")
      .withIndex("by_status_category_deadline", (q) =>
        q.eq("status", "active").eq("category", cause.category),
      )
      .take(SIMILAR_SCAN);
    const similar = [];
    for (const other of sameCategory) {
      if (similar.length === SIMILAR_COUNT) break;
      if (other._id === cause._id) continue;
      if (isListed(other, await structureOf(other.structureId))) {
        similar.push(await toSimilarView(ctx, other));
      }
    }

    const { paymentProvider, platformFeeRate } = loadConfig(process.env);
    return {
      id: cause._id,
      title: cause.title,
      description: cause.description,
      category: cause.category,
      urgency: cause.urgency,
      organization: {
        id: structure._id,
        name: structure.name,
        verified: true,
        city: `${structure.commune}, ${structure.region}`,
      },
      bannerUrl: await ctx.storage.getUrl(cause.bannerFileId),
      raised: cause.raised,
      goal: cause.goalAmount,
      percent: percentOf(cause.raised, cause.goalAmount),
      donorCount: cause.donorCount,
      endCondition: endConditionOf(cause),
      estimatedNet: computeFee(cause.goalAmount, paymentProvider, platformFeeRate).net,
      featured: cause.featuredAt !== undefined,
      status: cause.status,
      similar,
    };
  },
});

// ---------------------------------------------------------------------------
// Structure write path (PARCOURS S11–S14)
// ---------------------------------------------------------------------------

/** The content fields of a cause, validated for both create and edit. */
interface CauseContent {
  title: string;
  description: string;
  goalAmount: number;
  deadline: number;
}

/** Validates the title, description, goal and deadline; throws `VALIDATION` on the first bad one. */
function validateCauseContent(content: CauseContent, now: number): void {
  const title = content.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    throw appError("VALIDATION", fr.errors.causeTitleInvalid, "title");
  }
  if (content.description.trim().length < DESCRIPTION_MIN) {
    throw appError("VALIDATION", fr.errors.causeDescriptionInvalid, "description");
  }
  if (!Number.isSafeInteger(content.goalAmount) || content.goalAmount <= 0) {
    throw appError("VALIDATION", fr.errors.causeGoalInvalid, "goalAmount");
  }
  const { maxCauseDurationDays } = loadConfig(process.env);
  const maxDeadline = now + maxCauseDurationDays * DAY_MS;
  if (content.deadline <= now || content.deadline > maxDeadline) {
    throw appError(
      "VALIDATION",
      fr.errors.causeDeadlineInvalid(maxCauseDurationDays),
      "deadline",
    );
  }
}

/**
 * The caller's structure, or an error if it is not an approved, unsuspended structure. A hospital
 * (which never fundraises) and a pending/refused/suspended structure cannot publish causes.
 */
async function requirePublishingStructure(ctx: QueryCtx) {
  const { user } = await requireRole(ctx, "structure");
  const structure = user.structureId ? await ctx.db.get(user.structureId) : null;
  if (!structure || structure.status !== "approved" || structure.suspendedAt !== undefined) {
    throw appError("FORBIDDEN", fr.errors.structureNotApproved);
  }
  return { user, structure };
}

/**
 * Whether a cause may be withdrawn right now: while in moderation, or once active only if it has
 * never had a donation row (any status — a pending payment may still settle). Single source of truth
 * for both the `withdraw` mutation and the dashboard's withdraw action, so they never disagree.
 */
async function isWithdrawable(ctx: QueryCtx, cause: Doc<"causes">): Promise<boolean> {
  if (cause.status === "pending_review") return true;
  if (cause.status !== "active") return false;
  const donation = await ctx.db
    .query("donations")
    .withIndex("by_cause", (q) => q.eq("causeId", cause._id))
    .first();
  return donation === null;
}

/** The structure's own causes, newest first, for the dashboard (excludes deleted). */
export const mine = query({
  args: {},
  handler: async (ctx): Promise<StructureCauseView[]> => {
    const { user } = await requireRole(ctx, "structure");
    if (!user.structureId) return [];
    const causes = await ctx.db
      .query("causes")
      .withIndex("by_structure", (q) => q.eq("structureId", user.structureId!))
      .collect();
    causes.sort((a, b) => b.submittedAt - a.submittedAt);
    const visible = causes.filter((cause) => cause.status !== "deleted");
    // Resolve the banner URLs concurrently: one awaited getUrl per cause in a loop serialises the
    // storage round-trips and makes dashboard latency scale linearly with the number of causes.
    return Promise.all(
      visible.map(async (cause) => {
        const [bannerUrl, withdrawable] = await Promise.all([
          ctx.storage.getUrl(cause.bannerFileId),
          isWithdrawable(ctx, cause),
        ]);
        return {
          id: cause._id,
          title: cause.title,
          category: cause.category,
          bannerUrl,
          raised: cause.raised,
          goal: cause.goalAmount,
          percent: percentOf(cause.raised, cause.goalAmount),
          urgent: cause.urgency === "urgent",
          status: cause.status,
          refusalReason: cause.refusalReason ?? null,
          endCondition: endConditionOf(cause),
          donorCount: cause.donorCount,
          withdrawable,
          submittedAt: cause.submittedAt,
          fundsReleased: cause.fundsReleasedAt !== undefined,
        };
      }),
    );
  },
});

/** One of the caller's own causes with its editable fields, or null if not theirs. */
export const getOwned = query({
  args: { causeId: v.id("causes") },
  handler: async (ctx, { causeId }): Promise<OwnedCauseView | null> => {
    const { user } = await requireRole(ctx, "structure");
    const cause = await ctx.db.get(causeId);
    if (!cause || cause.structureId !== user.structureId) return null;
    return {
      id: cause._id,
      title: cause.title,
      description: cause.description,
      category: cause.category,
      endType: cause.endType,
      goalAmount: cause.goalAmount,
      deadline: cause.deadline,
      urgency: cause.urgency,
      bannerUrl: await ctx.storage.getUrl(cause.bannerFileId),
      status: cause.status,
      refusalReason: cause.refusalReason ?? null,
    };
  },
});

/** Creates a cause, owned by the caller's structure, as `pending_review` (PARCOURS S11). */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: categoryV,
    bannerFileId: v.id("_storage"),
    endType: endTypeV,
    goalAmount: v.number(),
    deadline: v.number(),
    urgency: urgencyV,
  },
  handler: async (ctx, args): Promise<{ id: Id<"causes">; status: CauseStatus }> => {
    const { user, structure } = await requirePublishingStructure(ctx);
    const now = Date.now();
    validateCauseContent(args, now);
    await validateUpload(ctx, args.bannerFileId, ["image"], "bannerFileId");

    const id = await ctx.db.insert("causes", {
      structureId: structure._id,
      title: args.title.trim(),
      description: args.description.trim(),
      category: args.category,
      bannerFileId: args.bannerFileId,
      endType: args.endType,
      goalAmount: args.goalAmount,
      deadline: args.deadline,
      extensionCount: 0,
      urgency: args.urgency,
      raised: 0,
      donorCount: 0,
      status: "pending_review",
      submittedAt: now,
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "cause.create",
      targetTable: "causes",
      targetId: id,
    });
    return { id, status: "pending_review" };
  },
});

/**
 * Edits a cause and sends it back to moderation ("Modifier et renvoyer", G6 interim default).
 * Only a cause that is `pending_review` or `refused` can be edited for now. Editing an `active`
 * cause (G7) is deferred: honouring "the old version stays visible during review" needs a schema
 * field for a shadow copy, and silently pulling a cause that already has donations out of the feed
 * would be worse — so it is refused until the board confirms G7.
 */
export const update = mutation({
  args: {
    causeId: v.id("causes"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(categoryV),
    bannerFileId: v.optional(v.id("_storage")),
    endType: v.optional(endTypeV),
    goalAmount: v.optional(v.number()),
    deadline: v.optional(v.number()),
    urgency: v.optional(urgencyV),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    // Authorise before revealing anything about the id: a missing cause and a cause owned by someone
    // else both answer FORBIDDEN, so a signed-in structure can't probe which causeIds exist.
    const { user } = await requireRole(ctx, "structure", "hospital");
    const cause = await ctx.db.get(args.causeId);
    if (!cause || cause.structureId !== user.structureId) {
      throw appError("FORBIDDEN", fr.errors.forbidden, "causeId");
    }
    if (cause.status !== "pending_review" && cause.status !== "refused") {
      throw appError("CONFLICT", fr.errors.causeNotEditable, "causeId");
    }

    const merged: CauseContent = {
      title: args.title ?? cause.title,
      description: args.description ?? cause.description,
      goalAmount: args.goalAmount ?? cause.goalAmount,
      deadline: args.deadline ?? cause.deadline,
    };
    validateCauseContent(merged, Date.now());
    if (args.bannerFileId) {
      await validateUpload(ctx, args.bannerFileId, ["image"], "bannerFileId");
    }

    await ctx.db.patch(cause._id, {
      title: merged.title.trim(),
      description: merged.description.trim(),
      goalAmount: merged.goalAmount,
      deadline: merged.deadline,
      ...(args.category ? { category: args.category } : {}),
      ...(args.endType ? { endType: args.endType } : {}),
      ...(args.urgency ? { urgency: args.urgency } : {}),
      ...(args.bannerFileId ? { bannerFileId: args.bannerFileId } : {}),
      // Re-enters moderation and the previous refusal reason no longer applies.
      status: "pending_review",
      refusalReason: undefined,
      submittedAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "cause.update",
      targetTable: "causes",
      targetId: cause._id,
    });
    return { ok: true };
  },
});

/**
 * Withdraws a cause from moderation (S13), or an active cause that has not received any donation.
 * A cause with donations cannot be withdrawn: its funds are governed by the deletion flow (Sprint 6).
 */
export const withdraw = mutation({
  args: { causeId: v.id("causes") },
  handler: async (ctx, { causeId }): Promise<{ ok: true }> => {
    // Authorise before revealing anything about the id (see `update`): missing and not-owned both FORBIDDEN.
    const { user } = await requireRole(ctx, "structure", "hospital");
    const cause = await ctx.db.get(causeId);
    if (!cause || cause.structureId !== user.structureId) {
      throw appError("FORBIDDEN", fr.errors.forbidden, "causeId");
    }

    if (!(await isWithdrawable(ctx, cause))) {
      throw appError("CONFLICT", fr.errors.causeNotWithdrawable, "causeId");
    }

    await ctx.db.patch(causeId, { status: "withdrawn" });
    await logAudit(ctx, {
      actorId: user._id,
      action: "cause.withdraw",
      targetTable: "causes",
      targetId: causeId,
    });
    return { ok: true };
  },
});
