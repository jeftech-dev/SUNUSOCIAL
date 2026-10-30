// Fixed-window rate limiter backed by the `rateLimits` table (DT-19).
// Kept in-house: Convex components need a live deployment for codegen.

import type { MutationCtx } from "../_generated/server";

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

/** Counts one hit on `key`; refuses once `max` hits happened within `windowMs`. */
export async function hitRateLimit(
  ctx: MutationCtx,
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!row || now - row.windowStart >= windowMs) {
    if (row) await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    else await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return { ok: true, retryAfterMs: 0 };
  }
  if (row.count >= max) {
    return { ok: false, retryAfterMs: row.windowStart + windowMs - now };
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return { ok: true, retryAfterMs: 0 };
}
