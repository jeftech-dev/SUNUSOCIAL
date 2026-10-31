// Read-side helpers for causes: which causes donors may see, and the views they get (DT-34).

import { percentOf, endConditionOf } from "../../lib/causes";
import type { CauseCardView, SimilarCauseView } from "../../lib/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * A verified structure: approved by a moderator and not suspended. Until the board decides G4
 * (suspended structure with active causes), a suspended structure's causes are hidden.
 */
export function isVerified(structure: Doc<"structures"> | null): structure is Doc<"structures"> {
  return (
    structure !== null && structure.status === "approved" && structure.suspendedAt === undefined
  );
}

/** Shown in the feed, the Coup de cœur slot and "Causes similaires". */
export function isListed(cause: Doc<"causes">, structure: Doc<"structures"> | null): boolean {
  return cause.status === "active" && isVerified(structure);
}

/** Loads structures by id, once each per function call. */
export function structureLoader(ctx: QueryCtx) {
  const cache = new Map<Id<"structures">, Promise<Doc<"structures"> | null>>();
  return (id: Id<"structures">) => {
    let structure = cache.get(id);
    if (!structure) {
      structure = ctx.db.get(id);
      cache.set(id, structure);
    }
    return structure;
  };
}

export async function toCardView(
  ctx: QueryCtx,
  cause: Doc<"causes">,
  structure: Doc<"structures">,
): Promise<CauseCardView> {
  return {
    id: cause._id,
    title: cause.title,
    category: cause.category,
    organization: { name: structure.name, verified: isVerified(structure) },
    bannerUrl: await ctx.storage.getUrl(cause.bannerFileId),
    raised: cause.raised,
    goal: cause.goalAmount,
    percent: percentOf(cause.raised, cause.goalAmount),
    urgent: cause.urgency === "urgent",
    endCondition: endConditionOf(cause),
  };
}

export async function toSimilarView(
  ctx: QueryCtx,
  cause: Doc<"causes">,
): Promise<SimilarCauseView> {
  return {
    id: cause._id,
    title: cause.title,
    raised: cause.raised,
    goal: cause.goalAmount,
    percent: percentOf(cause.raised, cause.goalAmount),
    bannerUrl: await ctx.storage.getUrl(cause.bannerFileId),
  };
}
