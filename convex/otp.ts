// SMS one-time codes (DT-2): donor signup, organisation contact phone, payout-number check,
// login 2FA, donor password reset.
//
// - 6 digits, stored only as a keyed hash, valid 10 minutes, 5 attempts.
// - Per number and purpose: at most 3 codes in 10 minutes, 10 in 24 hours, and 60 s between two.
// - Codes sent to people who are not signed in also count toward a global daily cap (SMS_DAILY_CAP).
// - Checking never throws on a wrong code: a throw would roll back the attempt counter.
// - Signup codes are checked first (`verify`) and marked used in the same transaction that creates
//   the account (`claimOtp`), so a failed account creation leaves the code usable.

import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { loadConfig } from "../lib/config";
import { getSmsProvider } from "../lib/sms";
import { fr } from "../lib/strings.fr";
import type { OtpPurpose } from "../lib/types";
import { maskPhone, normalizePhone } from "../lib/validation";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { hashOtp, randomOtpCode } from "./lib/crypto";
import { appError } from "./lib/errors";
import { hitRateLimit } from "./lib/rateLimit";
import { otpPurposeV } from "./validators";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const OTP_MAX_SENDS_PER_DAY = 10;
export const OTP_DAY_MS = 24 * 60 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;

/** Rate-limit key of the global daily cap on codes sent to people who are not signed in. */
export const SMS_DAILY_CAP_KEY = "sms:anonymous";

const ORG_ROLES = new Set(["structure", "hospital", "moderator"]);

export type OtpCheck = { ok: true } | { ok: false; reason: "invalid" | "expired" | "locked" };
export type OtpVerification =
  { ok: true; otpId: Id<"otpCodes"> } | { ok: false; reason: "invalid" | "expired" | "locked" };

export interface SendResult {
  channel: "sms";
  to: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Sends a code by SMS.
 * - `donor_signup`, `org_contact`, `payout_number`, `password_reset`: `phone` is required.
 * - `login_2fa`: no phone; the code goes to the signed-in account's phone and unlocks this session.
 *   Asking again within 60 s (e.g. after a page reload) keeps the code already sent.
 * The answer never reveals whether an account exists: `donor_signup` for a registered number sends
 * an "account exists" SMS instead of a code, and `password_reset` for an unknown number sends nothing.
 */
export const send = action({
  args: { purpose: otpPurposeV, phone: v.optional(v.string()) },
  handler: async (ctx, { purpose, phone: rawPhone }): Promise<SendResult> => {
    let phone: string;
    let userId: Id<"users"> | undefined;
    let sessionId: Id<"authSessions"> | undefined;
    let message: "code" | "accountExists" | null = "code";

    if (purpose === "login_2fa") {
      const authUserId = await getAuthUserId(ctx);
      const authSessionId = await getAuthSessionId(ctx);
      if (!authUserId || !authSessionId) {
        throw appError("UNAUTHENTICATED", fr.errors.notAuthenticated);
      }
      const target = await ctx.runQuery(internal.otp.loginTarget, { userId: authUserId });
      if (!target) throw appError("FORBIDDEN", fr.errors.forbidden);
      phone = target.phone;
      userId = authUserId;
      sessionId = authSessionId;
    } else {
      const normalized = rawPhone === undefined ? null : normalizePhone(rawPhone);
      if (!normalized) throw appError("VALIDATION", fr.errors.invalidPhone, "phone");
      phone = normalized;
      if (purpose === "donor_signup" || purpose === "password_reset") {
        const donorExists = await ctx.runQuery(internal.otp.donorExists, { phone });
        if (purpose === "donor_signup" && donorExists) message = "accountExists";
        if (purpose === "password_reset" && !donorExists) message = null;
      }
    }

    const code = randomOtpCode();
    const issued = await ctx.runMutation(internal.otp.issue, {
      purpose,
      phone,
      userId,
      sessionId,
      codeHash: await hashOtp(purpose, phone, code),
      delivered: message !== null,
    });
    if (!issued.ok) {
      throw appError(
        "RATE_LIMITED",
        issued.reason === "cooldown"
          ? fr.errors.otpCooldown(Math.ceil(issued.retryAfterMs / 1000))
          : issued.reason === "unavailable"
            ? fr.errors.smsUnavailable
            : fr.errors.otpRateLimited,
      );
    }
    if (!issued.reused && message !== null) {
      await getSmsProvider().send(
        phone,
        message === "code" ? fr.sms.code(code) : fr.sms.accountExists,
      );
    }
    return { channel: "sms", to: maskPhone(phone), expiresAt: issued.expiresAt };
  },
});

export const loginTarget = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.disabled || !ORG_ROLES.has(user.role) || !user.phone) return null;
    return { phone: user.phone };
  },
});

export const donorExists = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const users = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", phone))
      .collect();
    return users.some((u) => u.role === "donor");
  },
});

export const issue = internalMutation({
  args: {
    purpose: otpPurposeV,
    phone: v.string(),
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.id("authSessions")),
    codeHash: v.string(),
    /** False when no SMS goes out (reset for an unknown number): no cost, so no global cap. */
    delivered: v.boolean(),
  },
  handler: async (
    ctx,
    { delivered, ...args },
  ): Promise<
    | { ok: true; expiresAt: number; reused: boolean }
    | { ok: false; reason: "cooldown" | "limit" | "unavailable"; retryAfterMs: number }
  > => {
    const now = Date.now();
    const today = await ctx.db
      .query("otpCodes")
      .withIndex("by_phone_purpose", (q) => q.eq("phone", args.phone).eq("purpose", args.purpose))
      .order("desc")
      .filter((q) => q.gt(q.field("_creationTime"), now - OTP_DAY_MS))
      .collect();
    const last = today[0];
    if (last && now - last._creationTime < OTP_COOLDOWN_MS) {
      // A reload of the 2FA step: the code sent to this session moments ago is still good.
      if (
        args.sessionId !== undefined &&
        last.sessionId === args.sessionId &&
        last.usedAt === undefined &&
        last.attempts < OTP_MAX_ATTEMPTS
      ) {
        return { ok: true, expiresAt: last.expiresAt, reused: true };
      }
      return {
        ok: false,
        reason: "cooldown",
        retryAfterMs: last._creationTime + OTP_COOLDOWN_MS - now,
      };
    }
    const recent = today.filter((row) => row._creationTime > now - OTP_SEND_WINDOW_MS);
    if (recent.length >= OTP_MAX_SENDS) {
      const oldest = recent[recent.length - 1];
      return {
        ok: false,
        reason: "limit",
        retryAfterMs: oldest._creationTime + OTP_SEND_WINDOW_MS - now,
      };
    }
    if (today.length >= OTP_MAX_SENDS_PER_DAY) {
      const oldest = today[today.length - 1];
      return {
        ok: false,
        reason: "limit",
        retryAfterMs: oldest._creationTime + OTP_DAY_MS - now,
      };
    }
    // 2FA codes need a password first, so only anonymous sends count toward the global cap.
    if (delivered && args.purpose !== "login_2fa") {
      const cap = await hitRateLimit(ctx, SMS_DAILY_CAP_KEY, {
        max: loadConfig(process.env).smsDailyCap,
        windowMs: OTP_DAY_MS,
      });
      if (!cap.ok) {
        console.error(`[otp] SMS daily cap reached; refusing ${args.purpose} codes`);
        return { ok: false, reason: "unavailable", retryAfterMs: cap.retryAfterMs };
      }
    }
    const expiresAt = now + OTP_TTL_MS;
    await ctx.db.insert("otpCodes", { ...args, attempts: 0, expiresAt });
    return { ok: true, expiresAt, reused: false };
  },
});

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

/**
 * Checks `code` against the latest code for this number and purpose (and session, for 2FA).
 * Counts a failed attempt, but does not mark the code used: see `claimOtp`.
 */
export async function verifyOtp(
  ctx: MutationCtx,
  args: { purpose: OtpPurpose; phone: string; code: string; sessionId?: Id<"authSessions"> },
): Promise<OtpVerification> {
  const latest = await ctx.db
    .query("otpCodes")
    .withIndex("by_phone_purpose", (q) => q.eq("phone", args.phone).eq("purpose", args.purpose))
    .order("desc")
    .first();
  if (!latest || latest.usedAt !== undefined) return { ok: false, reason: "invalid" };
  if (args.sessionId !== undefined && latest.sessionId !== args.sessionId) {
    return { ok: false, reason: "invalid" };
  }
  if (latest.expiresAt <= Date.now()) return { ok: false, reason: "expired" };
  if (latest.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  const hash = await hashOtp(args.purpose, args.phone, args.code);
  if (hash !== latest.codeHash) {
    await ctx.db.patch(latest._id, { attempts: latest.attempts + 1 });
    return {
      ok: false,
      reason: latest.attempts + 1 >= OTP_MAX_ATTEMPTS ? "locked" : "invalid",
    };
  }
  return { ok: true, otpId: latest._id };
}

/**
 * Marks a verified code used. Throws if it was used or expired meanwhile, which rolls back the
 * caller's transaction (e.g. the account creation it belongs to).
 */
export async function claimOtp(ctx: MutationCtx, otpId: Id<"otpCodes">): Promise<void> {
  const row = await ctx.db.get(otpId);
  if (!row || row.usedAt !== undefined || row.expiresAt <= Date.now()) {
    throw appError("OTP_INVALID", fr.errors.otpInvalid);
  }
  await ctx.db.patch(otpId, { usedAt: Date.now() });
}

/** Verifies and marks used in one step (2FA, password reset). */
export async function checkOtp(
  ctx: MutationCtx,
  args: { purpose: OtpPurpose; phone: string; code: string; sessionId?: Id<"authSessions"> },
): Promise<OtpCheck> {
  const result = await verifyOtp(ctx, args);
  if (!result.ok) return result;
  await claimOtp(ctx, result.otpId);
  return { ok: true };
}

/** Verifies a code from an action without using it up; the caller claims it later. */
export const verify = internalMutation({
  args: { purpose: otpPurposeV, phone: v.string(), code: v.string() },
  handler: (ctx, args): Promise<OtpVerification> => verifyOtp(ctx, args),
});

/** Verifies and uses up a code from an action (password reset). */
export const consume = internalMutation({
  args: { purpose: otpPurposeV, phone: v.string(), code: v.string() },
  handler: (ctx, args): Promise<OtpCheck> => checkOtp(ctx, args),
});

export function otpErrorMessage(check: { reason: "invalid" | "expired" | "locked" }): string {
  return check.reason === "locked" ? fr.errors.otpLocked : fr.errors.otpInvalid;
}

/**
 * Second login step for structures, hospitals and moderators: unlocks the current session
 * (`authSessions.mfaVerifiedAt`). Returns the error instead of throwing, so attempts are counted.
 */
export const verifyLogin = mutation({
  args: { code: v.string() },
  handler: async (
    ctx,
    { code },
  ): Promise<{ ok: true } | { ok: false; error: { code: "OTP_INVALID"; message: string } }> => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!userId || !sessionId) throw appError("UNAUTHENTICATED", fr.errors.notAuthenticated);
    const user = await ctx.db.get(userId);
    if (!user || user.disabled || !ORG_ROLES.has(user.role) || !user.phone) {
      throw appError("FORBIDDEN", fr.errors.forbidden);
    }
    const check = await checkOtp(ctx, {
      purpose: "login_2fa",
      phone: user.phone,
      code: code.trim(),
      sessionId,
    });
    if (!check.ok) {
      return { ok: false, error: { code: "OTP_INVALID", message: otpErrorMessage(check) } };
    }
    await ctx.db.patch(sessionId, { mfaVerifiedAt: Date.now() });
    await logAudit(ctx, {
      actorId: userId,
      action: "auth.mfa",
      targetTable: "authSessions",
      targetId: sessionId,
    });
    return { ok: true };
  },
});
