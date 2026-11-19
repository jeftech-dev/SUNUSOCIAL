// Reading the caller's in-app notifications (written by `notifyUser`, DT-17).

import { v } from "convex/values";

import type { NotificationKind } from "../lib/types";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { notificationKindV } from "./validators";

const LIST_LIMIT = 30;

/**
 * The latest notifications of the caller, newest first, optionally restricted to some kinds.
 * Ordered by creation time: `by_user_read` sorts by `readAt` first, which pushes new unread rows
 * behind every read one.
 */
export const listMine = query({
  args: { kinds: v.optional(v.array(notificationKindV)) },
  handler: async (ctx, { kinds }) => {
    const { user } = await requireUser(ctx);
    const wanted: ReadonlySet<NotificationKind> | null = kinds ? new Set(kinds) : null;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(wanted ? 200 : LIST_LIMIT);
    // A message pointing at a deleted cause would open a 404: drop it from the list.
    const causeLinkId = (link?: string) => link?.match(/^\/causes\/([^/?#]+)$/)?.[1];
    const deletedCauses = new Set<string>();
    for (const row of rows) {
      const id = causeLinkId(row.link);
      if (!id || deletedCauses.has(id)) continue;
      const causeId = ctx.db.normalizeId("causes", id);
      const cause = causeId ? await ctx.db.get(causeId) : null;
      if (!cause || cause.status === "deleted") deletedCauses.add(id);
    }
    return rows
      .filter((row) => !wanted || wanted.has(row.kind))
      .filter((row) => {
        const id = causeLinkId(row.link);
        return !id || !deletedCauses.has(id);
      })
      .slice(0, LIST_LIMIT)
      .map(({ _id, kind, title, body, link, readAt, createdAt }) => ({
        _id,
        kind,
        title,
        body,
        link: link ?? null,
        read: readAt !== undefined,
        createdAt,
      }));
  },
});

/** Marks the given notifications (or all of the caller's) as read. */
export const markRead = mutation({
  args: { ids: v.optional(v.array(v.id("notifications"))) },
  handler: async (ctx, { ids }) => {
    const { user } = await requireUser(ctx);
    const now = Date.now();
    if (ids) {
      for (const id of ids) {
        const row = await ctx.db.get(id);
        if (row && row.userId === user._id && row.readAt === undefined) {
          await ctx.db.patch(id, { readAt: now });
        }
      }
    } else {
      const unread = await ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
        .take(200);
      for (const row of unread) await ctx.db.patch(row._id, { readAt: now });
    }
    return { ok: true as const };
  },
});
