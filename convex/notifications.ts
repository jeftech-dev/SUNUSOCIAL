// Reading the caller's in-app notifications (written by `notifyUser`, DT-17).

import { v } from "convex/values";

import type { NotificationKind } from "../lib/types";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/guards";
import { notificationKindV } from "./validators";

const LIST_LIMIT = 30;

/** The latest notifications of the caller, optionally restricted to some kinds. */
export const listMine = query({
  args: { kinds: v.optional(v.array(notificationKindV)) },
  handler: async (ctx, { kinds }) => {
    const { user } = await requireUser(ctx);
    const wanted: ReadonlySet<NotificationKind> | null = kinds ? new Set(kinds) : null;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(wanted ? 200 : LIST_LIMIT);
    return rows
      .filter((row) => !wanted || wanted.has(row.kind))
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
