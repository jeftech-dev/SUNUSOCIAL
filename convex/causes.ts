// Causes: the donor read path (feed, Coup de cœur, detail). Spec: docs/API_CONTRACT.md "Causes".
// Only active causes from verified structures are listed (DT-34).

import { paginationOptsValidator, type OrderedQuery } from "convex/server";
import { v } from "convex/values";

import { ALMOST_REACHED_PERCENT, endConditionOf, percentOf } from "../lib/causes";
import { loadConfig } from "../lib/config";
import { computeFee } from "../lib/money";
import {
  CAUSE_FILTERS,
  type CauseCardView,
  type CauseDetailView,
  type CauseFilter,
  type Category,
} from "../lib/types";
import type { DataModel } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { isListed, isVerified, structureLoader, toCardView, toSimilarView } from "./lib/causeViews";
import { requireRole } from "./lib/guards";
import { categoryV, literals } from "./validators";

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
