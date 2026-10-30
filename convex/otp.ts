// SMS one-time codes (DT-2): donor signup, payout-number check, login 2FA, donor password reset.
//
// - 6 digits, stored only as a hash, valid 10 minutes, 5 attempts.
// - At most 3 codes per number and purpose in 10 minutes, and 60 s between two codes.
// - Verification never throws on a wrong code: a throw would roll back the attempt counter.

import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

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
import { otpPurposeV } from "./validators";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;

const ORG_ROLES = new Set(["structure", "hospital", "moderator"]);

export type OtpCheck = { ok: true } | { ok: false; reason: "invalid" | "expired" | "locked" };

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
 * - `donor_signup`, `payout_number`, `password_reset`: `phone` is required.
 * - `login_2fa`: no phone; the code goes to the signed-in account's phone and unlocks this session.
 * `password_reset` answers the same whether or not an account exists.
 */
export const send = action({
  args: { purpose: otpPurposeV, phone: v.optional(v.string()) },
  handler: async (ctx, { purpose, phone: rawPhone }): Promise<SendResult> => {
    let phone: string;
    let userId: Id<"users"> | undefined;
    let sessionId: Id<"authSessions"> | undefined;
    let deliver = true;

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
      const donorExists = await ctx.runQuery(internal.otp.donorExists, { phone });
      if (purpose === "donor_signup" && donorExists) {
        throw appError("CONFLICT", fr.errors.phoneTaken, "phone");
      }
      // Don't reveal whether an account exists: issue the code either way, send it only if so.
      if (purpose === "password_reset") deliver = donorExists;
    }

    const code = randomOtpCode();
    const issued = await ctx.runMutation(internal.otp.issue, {
      purpose,
      phone,
      userId,
      sessionId,
      codeHash: await hashOtp(purpose, phone, code),
    });
    if (!issued.ok) {
      throw appError(
        "RATE_LIMITED",
        issued.reason === "cooldown"
          ? fr.errors.otpCooldown(Math.ceil(issued.retryAfterMs / 1000))
          : fr.errors.otpRateLimited,
      );
    }
    if (deliver) await getSmsProvider().send(phone, fr.sms.code(code));
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
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; expiresAt: number }
    | { ok: false; reason: "cooldown" | "limit"; retryAfterMs: number }
  > => {
    const now = Date.now();
    const recent = await ctx.db
      .query("otpCodes")
      .withIndex("by_phone_purpose", (q) => q.eq("phone", args.phone).eq("purpose", args.purpose))
      .order("desc")
      .filter((q) => q.gt(q.field("_creationTime"), now - OTP_SEND_WINDOW_MS))
      .collect();
    const last = recent[0];
    if (last && now - last._creationTime < OTP_COOLDOWN_MS) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterMs: last._creationTime + OTP_COOLDOWN_MS - now,
      };
    }
    if (recent.length >= OTP_MAX_SENDS) {
      const oldest = recent[recent.length - 1];
      return {
        ok: false,
        reason: "limit",
        retryAfterMs: oldest._creationTime + OTP_SEND_WINDOW_MS - now,
      };
    }
    const expiresAt = now + OTP_TTL_MS;
    await ctx.db.insert("otpCodes", { ...args, attempts: 0, expiresAt });
    return { ok: true, expiresAt };
  },
});

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

/**
 * Checks `code` against the latest code for this number and purpose (and session, for 2FA).
 * Counts a failed attempt; marks the code used on success.
 */
export async function checkOtp(
  ctx: MutationCtx,
  args: { purpose: OtpPurpose; phone: string; code: string; sessionId?: Id<"authSessions"> },
): Promise<OtpCheck> {
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
  await ctx.db.patch(latest._id, { usedAt: Date.now() });
  return { ok: true };
}

/** Consumes a code from an action (signup, payout number, password reset). */
export const consume = internalMutation({
  args: { purpose: otpPurposeV, phone: v.string(), code: v.string() },
  handler: (ctx, args): Promise<OtpCheck> => checkOtp(ctx, args),
});

export function otpErrorMessage(check: Exclude<OtpCheck, { ok: true }>): string {
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
