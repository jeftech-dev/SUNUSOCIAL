// In-app notifications, with an optional SMS (DT-17). Email to organisations comes with the
// moderation notifications (Sprint 5).

import { v } from "convex/values";

import { getSmsProvider } from "../lib/sms";
import type { NotificationKind } from "../lib/types";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type MutationCtx } from "./_generated/server";

export interface NotificationInput {
  userId: Id<"users">;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  /** Also sent by SMS to the user's phone, after the mutation commits. */
  sms?: string;
}

export async function notifyUser(ctx: MutationCtx, input: NotificationInput): Promise<void> {
  const { sms, ...notification } = input;
  await ctx.db.insert("notifications", { ...notification, createdAt: Date.now() });
  if (sms) {
    const user = await ctx.db.get(input.userId);
    if (user?.phone) {
      await ctx.scheduler.runAfter(0, internal.notify.sendSms, { to: user.phone, text: sms });
    }
  }
}

export const sendSms = internalAction({
  args: { to: v.string(), text: v.string() },
  handler: async (_ctx, { to, text }) => {
    await getSmsProvider().send(to, text);
  },
});
