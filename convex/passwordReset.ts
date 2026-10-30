// Password reset (DT-15). Requests never reveal whether an account exists; a reset ends every
// session of the account (DT-27).
//
// - Donors: SMS code (`otp.send({ purpose: "password_reset", phone })`), then `resetWithSmsCode`.
// - Structures, hospitals, moderators: `requestEmailReset` emails a single-use link valid 30 min,
//   then `resetWithToken`. The SMS code is asked again at the next login.

import { invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { getEmailProvider } from "../lib/email";
import { fr } from "../lib/strings.fr";
import {
  isValidPassword,
  normalizeEmail,
  normalizePhone,
  PASSWORD_MIN_LENGTH,
} from "../lib/validation";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { logAudit } from "./audit";
import { PASSWORD_PROVIDER } from "./auth";
import { randomToken, sha256Hex } from "./lib/crypto";
import { appError } from "./lib/errors";
import { hitRateLimit } from "./lib/rateLimit";
import { otpErrorMessage } from "./otp";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const hashToken = (token: string) => sha256Hex(`reset:${token}`);

// ---------------------------------------------------------------------------
// Donors: SMS code
// ---------------------------------------------------------------------------

export const donorByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const users = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", phone))
      .collect();
    return users.find((u) => u.role === "donor")?._id ?? null;
  },
});

export const resetWithSmsCode = action({
  args: { phone: v.string(), code: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const phone = normalizePhone(args.phone);
    if (!phone) throw appError("VALIDATION", fr.errors.invalidPhone, "phone");
    if (!isValidPassword(args.newPassword, "donor")) {
      throw appError(
        "VALIDATION",
        fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.donor),
        "newPassword",
      );
    }
    const check = await ctx.runMutation(internal.otp.consume, {
      purpose: "password_reset",
      phone,
      code: args.code.trim(),
    });
    if (!check.ok) throw appError("OTP_INVALID", otpErrorMessage(check), "code");
    const userId = await ctx.runQuery(internal.passwordReset.donorByPhone, { phone });
    // A code can only be valid for an existing donor, but stay generic regardless.
    if (!userId) throw appError("OTP_INVALID", fr.errors.otpInvalid, "code");

    await setPassword(ctx, { userId, accountId: phone, password: args.newPassword });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Organisations and moderators: email link
// ---------------------------------------------------------------------------

export const orgAccountByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();
    const user = users.find((u) => u.role !== "donor" && !u.disabled);
    return user ? { userId: user._id, role: user.role } : null;
  },
});

export const issueToken = internalMutation({
  args: { userId: v.id("users"), tokenHash: v.string() },
  handler: async (ctx, { userId, tokenHash }) => {
    // One live link per account: older unused links stop working.
    const previous = await ctx.db
      .query("passwordResets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("usedAt"), undefined))
      .collect();
    const now = Date.now();
    for (const row of previous) await ctx.db.patch(row._id, { usedAt: now });
    await ctx.db.insert("passwordResets", {
      userId,
      tokenHash,
      expiresAt: now + RESET_TOKEN_TTL_MS,
    });
  },
});

export const rateLimitEmailReset = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    (await hitRateLimit(ctx, `reset:${email}`, { max: 3, windowMs: 10 * 60 * 1000 })).ok,
});

/** Base URL of the app a user signs in to: moderators use the moderation subdomain (DT-9). */
function siteUrlFor(role: string): string {
  const url =
    role === "moderator"
      ? (process.env.MODERATION_SITE_URL ?? process.env.SITE_URL)
      : process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL is not set");
  return url.replace(/\/$/, "");
}

/** Emails a reset link to an organisation or moderator account. Used by admin.createModerator too. */
export async function sendResetLink(
  ctx: ActionCtx,
  {
    userId,
    role,
    email,
    welcome = false,
  }: { userId: Id<"users">; role: string; email: string; welcome?: boolean },
): Promise<void> {
  const token = randomToken();
  await ctx.runMutation(internal.passwordReset.issueToken, {
    userId,
    tokenHash: await hashToken(token),
  });
  const link = `${siteUrlFor(role)}/mot-de-passe/nouveau?token=${token}`;
  await getEmailProvider().send({
    to: email,
    subject: welcome ? fr.email.welcomeModeratorSubject : fr.email.resetSubject,
    text: welcome ? fr.email.welcomeModeratorBody(link) : fr.email.resetBody(link),
  });
}

/** Always answers `{ ok: true }`, whether or not the account exists. */
export const requestEmailReset = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const email = normalizeEmail(args.email);
    if (!email) throw appError("VALIDATION", fr.errors.invalidEmail, "email");
    if (!(await ctx.runMutation(internal.passwordReset.rateLimitEmailReset, { email }))) {
      return { ok: true };
    }
    const account = await ctx.runQuery(internal.passwordReset.orgAccountByEmail, { email });
    if (account) await sendResetLink(ctx, { ...account, email });
    return { ok: true };
  },
});

export const consumeToken = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const row = await ctx.db
      .query("passwordResets")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!row || row.usedAt !== undefined || row.expiresAt <= Date.now()) return null;
    await ctx.db.patch(row._id, { usedAt: Date.now() });
    const user = await ctx.db.get(row.userId);
    if (!user || user.disabled || !user.email) return null;
    return { userId: user._id, email: user.email, role: user.role };
  },
});

export const resetWithToken = action({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<{ ok: true; role: string }> => {
    if (!isValidPassword(args.newPassword, "organization")) {
      throw appError(
        "VALIDATION",
        fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.organization),
        "newPassword",
      );
    }
    const account = await ctx.runMutation(internal.passwordReset.consumeToken, {
      tokenHash: await hashToken(args.token.trim()),
    });
    if (!account) throw appError("VALIDATION", fr.errors.resetLinkInvalid, "token");
    await setPassword(ctx, {
      userId: account.userId,
      accountId: account.email,
      password: args.newPassword,
    });
    return { ok: true, role: account.role };
  },
});

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const logPasswordChange = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await logAudit(ctx, {
      actorId: userId,
      action: "auth.passwordReset",
      targetTable: "users",
      targetId: userId,
    });
  },
});

/** Sets a new password, ends every session of the account and logs the change. */
async function setPassword(
  ctx: ActionCtx,
  { userId, accountId, password }: { userId: Id<"users">; accountId: string; password: string },
) {
  await modifyAccountCredentials(ctx, {
    provider: PASSWORD_PROVIDER,
    account: { id: accountId, secret: password },
  });
  await invalidateSessions(ctx, { userId });
  await ctx.runMutation(internal.passwordReset.logPasswordChange, { userId });
}
