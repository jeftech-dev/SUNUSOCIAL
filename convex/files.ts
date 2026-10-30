// Signup receipts (convex-file-storage, convex-http-actions). The document is uploaded before the
// account exists, so the upload is authorised by the SMS code sent to the contact phone
// (`org_contact`, DT-33) and rate-limited per phone. Size and type are checked before storing,
// and the type is read from the file's first bytes. `registerOrganization` attaches the file;
// a daily cron deletes the files of abandoned signups.

import { v } from "convex/values";

import { fr } from "../lib/strings.fr";
import type { ApiError } from "../lib/types";
import {
  normalizePhone,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  sniffReceiptType,
} from "../lib/validation";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, internalMutation, type QueryCtx } from "./_generated/server";
import { hitRateLimit } from "./lib/rateLimit";
import { otpErrorMessage, verifyOtp } from "./otp";

export const SIGNUP_RECEIPT_PATH = "/signup/receipt";
export const SIGNUP_UPLOAD_MAX = 5;
export const SIGNUP_UPLOAD_WINDOW_MS = 10 * 60 * 1000;
/** Uploads not attached to an account after this long belong to abandoned signups. */
export const SIGNUP_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH = 100;

// ---------------------------------------------------------------------------
// HTTP endpoint: POST /signup/receipt
// ---------------------------------------------------------------------------

function corsHeaders(request: Request): Record<string, string> {
  const allowed = process.env.SITE_URL?.replace(/\/$/, "");
  const origin = request.headers.get("Origin");
  if (!allowed || origin !== allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Signup-Phone, X-Signup-Code",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function json(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

function fail(request: Request, status: number, error: ApiError): Response {
  return json(request, status, { error });
}

export const signupReceiptPreflight = httpAction(async (_ctx, request) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
});

/**
 * Body: the file. Headers: `Content-Type` (PDF, JPG or PNG), `X-Signup-Phone` (contact phone),
 * `X-Signup-Code` (the `org_contact` code sent to it). Answers `{ storageId }` or `{ error }`.
 */
export const uploadSignupReceipt = httpAction(async (ctx, request) => {
  const invalidFile = (status: number) =>
    fail(request, status, {
      code: "VALIDATION",
      message: fr.errors.receiptInvalid,
      field: "receiptFileId",
    });

  const phone = normalizePhone(request.headers.get("X-Signup-Phone") ?? "");
  if (!phone) {
    return fail(request, 400, {
      code: "VALIDATION",
      message: fr.errors.invalidPhone,
      field: "responsiblePhone",
    });
  }
  const declaredType = (request.headers.get("Content-Type") ?? "").split(";")[0].trim();
  if (!(RECEIPT_TYPES as readonly string[]).includes(declaredType)) return invalidFile(415);
  const declaredSize = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredSize > RECEIPT_MAX_BYTES) return invalidFile(413);

  const authorized = await ctx.runMutation(internal.files.authorizeSignupUpload, {
    phone,
    code: (request.headers.get("X-Signup-Code") ?? "").trim(),
  });
  if (!authorized.ok) return fail(request, authorized.status, authorized.error);

  const blob = await request.blob();
  if (blob.size === 0 || blob.size > RECEIPT_MAX_BYTES) return invalidFile(413);
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const type = sniffReceiptType(head);
  if (type === null || type !== declaredType) return invalidFile(415);

  const storageId = await ctx.storage.store(new Blob([blob], { type }));
  await ctx.runMutation(internal.files.recordSignupUpload, { storageId, phone });
  return json(request, 200, { storageId });
});

/** Checks the contact phone's code (without using it up) and the per-phone upload limit. */
export const authorizeSignupUpload = internalMutation({
  args: { phone: v.string(), code: v.string() },
  handler: async (
    ctx,
    { phone, code },
  ): Promise<{ ok: true } | { ok: false; status: number; error: ApiError }> => {
    const check = await verifyOtp(ctx, { purpose: "org_contact", phone, code });
    if (!check.ok) {
      return {
        ok: false,
        status: 403,
        error: { code: "OTP_INVALID", message: otpErrorMessage(check), field: "contactOtpCode" },
      };
    }
    const limit = await hitRateLimit(ctx, `upload:${phone}`, {
      max: SIGNUP_UPLOAD_MAX,
      windowMs: SIGNUP_UPLOAD_WINDOW_MS,
    });
    if (!limit.ok) {
      return {
        ok: false,
        status: 429,
        error: { code: "RATE_LIMITED", message: fr.errors.rateLimited, field: null },
      };
    }
    return { ok: true };
  },
});

export const recordSignupUpload = internalMutation({
  args: { storageId: v.id("_storage"), phone: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("signupUploads", { ...args, createdAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// Attaching and cleaning up
// ---------------------------------------------------------------------------

/** The pending upload of `storageId` made for `phone`, or null. */
export async function findSignupUpload(ctx: QueryCtx, storageId: Id<"_storage">, phone: string) {
  const upload = await ctx.db
    .query("signupUploads")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
  return upload && upload.phone === phone ? upload : null;
}

/** Deletes uploads (and their files) never attached to an account within SIGNUP_UPLOAD_TTL_MS. */
export const purgeAbandonedUploads = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const stale = await ctx.db
      .query("signupUploads")
      .withIndex("by_created", (q) => q.lt("createdAt", Date.now() - SIGNUP_UPLOAD_TTL_MS))
      .take(PURGE_BATCH);
    for (const upload of stale) {
      if (await ctx.db.system.get(upload.storageId)) await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
    }
    if (stale.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.files.purgeAbandonedUploads, {});
    }
    return { deleted: stale.length };
  },
});
