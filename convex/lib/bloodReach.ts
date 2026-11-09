// Opted-in donor counts per (blood group, commune), kept in step with `donorProfiles`. The alert
// composer's reach estimate reads one counter row per combination instead of scanning profiles,
// so a wide alert ("Tous groupes" × several communes) stays far under the transaction read limits.

import type { BloodType } from "../../lib/types";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReachFields = Pick<Doc<"donorProfiles">, "bloodOptIn" | "bloodType" | "commune">;

/** The counter a profile belongs to, or null when the fan-out would not reach it. */
function reachKey(
  profile: ReachFields | null | undefined,
): { bloodType: BloodType; commune: string } | null {
  if (!profile?.bloodOptIn || !profile.bloodType || !profile.commune) return null;
  return { bloodType: profile.bloodType, commune: profile.commune };
}

async function bump(
  ctx: MutationCtx,
  key: { bloodType: BloodType; commune: string },
  delta: number,
): Promise<void> {
  const row = await ctx.db
    .query("bloodReach")
    .withIndex("by_type_commune", (q) =>
      q.eq("bloodType", key.bloodType).eq("commune", key.commune),
    )
    .unique();
  if (row) await ctx.db.patch(row._id, { count: Math.max(0, row.count + delta) });
  else if (delta > 0) await ctx.db.insert("bloodReach", { ...key, count: delta });
}

/**
 * Moves a donor between counters when their profile changes. Call it with the profile before and
 * after every insert or patch of `donorProfiles` (null for a new profile).
 */
export async function adjustBloodReach(
  ctx: MutationCtx,
  before: ReachFields | null | undefined,
  after: ReachFields | null | undefined,
): Promise<void> {
  const from = reachKey(before);
  const to = reachKey(after);
  if (from && to && from.bloodType === to.bloodType && from.commune === to.commune) return;
  if (from) await bump(ctx, from, -1);
  if (to) await bump(ctx, to, 1);
}

/** Opted-in donors in one (group, commune) combination. */
export async function reachOf(
  ctx: QueryCtx,
  bloodType: BloodType,
  commune: string,
): Promise<number> {
  const row = await ctx.db
    .query("bloodReach")
    .withIndex("by_type_commune", (q) => q.eq("bloodType", bloodType).eq("commune", commune))
    .unique();
  return row?.count ?? 0;
}
