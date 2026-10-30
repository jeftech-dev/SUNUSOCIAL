// Accounts and sessions (DT-1, DT-2, DT-27, DB-7, DB-8, DB-15).
//
// - Sign-in goes through Convex Auth: `signIn("password", { flow: "signIn", identifier, password,
//   audience })`. Donors use their phone, organisations and moderators their email.
// - Registration runs as dedicated actions (`registerDonor`, `registerOrganization`) that verify the
//   SMS codes first, then create the account; the codes are marked used in the same transaction
//   that creates it (`insertNewUser`). The client signs in afterwards.
// - Structures, hospitals and moderators must also pass the SMS code on every login
//   (`otp.send({ purpose: "login_2fa" })` + `otp.verifyLogin`); see convex/lib/guards.ts.

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  convexAuth,
  createAccount,
  getAuthSessionId,
  getAuthUserId,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import { v } from "convex/values";

import { config as appConfig, DAY_MS } from "../lib/config";
import { isValidCommune, isValidRegion } from "../lib/geo";
import { fr } from "../lib/strings.fr";
import {
  HOSPITAL_TYPE,
  type BloodType,
  type Method,
  type Role,
  type StructureType,
} from "../lib/types";
import {
  isValidPassword,
  normalizeEmail,
  normalizeIdentifier,
  normalizeName,
  normalizePhone,
  PASSWORD_MIN_LENGTH,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
} from "../lib/validation";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { appError } from "./lib/errors";
import { findSignupUpload } from "./files";
import { requireRole } from "./lib/guards";
import { claimOtp, otpErrorMessage } from "./otp";
import { bloodTypeV, methodV, structureTypeV } from "./validators";

/** The single credentials provider id (accounts: phone for donors, email for everyone else). */
export const PASSWORD_PROVIDER = "password";

// ---------------------------------------------------------------------------
// New-account profiles, passed through createAccount to createOrUpdateUser
// ---------------------------------------------------------------------------

interface BloodProfileInput {
  optIn: boolean;
  bloodType?: BloodType;
  region?: string;
  commune?: string;
  smsOptIn: boolean;
}

type NewAccountProfile =
  | {
      kind: "donor";
      name: string;
      phone: string;
      bloodProfile?: BloodProfileInput;
      /** Verified signup codes, marked used with the account creation. */
      otpIds: Id<"otpCodes">[];
    }
  | {
      kind: "organization";
      role: "structure" | "hospital";
      name: string;
      email: string;
      phone: string;
      structure: {
        name: string;
        type: StructureType;
        region: string;
        commune: string;
        receiptNo?: string;
        receiptFileId: Id<"_storage">;
        payout?: { method: Method; accountNumber: string; holderName: string };
      };
      otpIds: Id<"otpCodes">[];
    }
  | { kind: "moderator"; name: string; email: string; phone: string };

async function insertNewUser(ctx: MutationCtx, profile: NewAccountProfile): Promise<Id<"users">> {
  const now = Date.now();
  // Throws if a code was used meanwhile, which rolls back the whole account creation.
  if (profile.kind !== "moderator") {
    for (const otpId of profile.otpIds) await claimOtp(ctx, otpId);
  }
  switch (profile.kind) {
    case "donor": {
      const userId = await ctx.db.insert("users", {
        name: profile.name,
        phone: profile.phone,
        role: "donor",
        phoneVerifiedAt: now,
        disabled: false,
        createdAt: now,
      });
      const blood = profile.bloodProfile;
      await ctx.db.insert("donorProfiles", {
        userId,
        bloodOptIn: blood?.optIn ?? false,
        bloodType: blood?.optIn ? blood.bloodType : undefined,
        region: blood?.region,
        commune: blood?.commune,
        smsOptIn: blood?.optIn ? blood.smsOptIn : false,
        updatedAt: now,
      });
      await logAudit(ctx, {
        actorId: userId,
        action: "auth.signup",
        targetTable: "users",
        targetId: userId,
        details: { role: "donor" },
      });
      if (blood?.optIn) {
        await logAudit(ctx, {
          actorId: userId,
          action: "blood.optIn",
          targetTable: "donorProfiles",
          targetId: userId,
        });
      }
      return userId;
    }
    case "organization": {
      const s = profile.structure;
      const upload = await findSignupUpload(ctx, s.receiptFileId, profile.phone);
      if (!upload) throw appError("VALIDATION", fr.errors.receiptRequired, "receiptFileId");
      await ctx.db.delete(upload._id);
      const structureId = await ctx.db.insert("structures", {
        name: s.name,
        type: s.type,
        region: s.region,
        commune: s.commune,
        contactName: profile.name,
        phone: profile.phone,
        email: profile.email,
        receiptNo: s.receiptNo,
        receiptFileId: s.receiptFileId,
        // The number was proven by SMS code; the moderator approves it with the documents.
        payout: s.payout && { ...s.payout, phoneVerifiedAt: now },
        status: "pending",
        onboardingPhase: 1,
        createdAt: now,
      });
      const userId = await ctx.db.insert("users", {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        structureId,
        phoneVerifiedAt: now,
        disabled: false,
        createdAt: now,
      });
      await logAudit(ctx, {
        actorId: userId,
        action: "auth.signup",
        targetTable: "structures",
        targetId: structureId,
        details: { role: profile.role, type: s.type },
      });
      return userId;
    }
    case "moderator": {
      const userId = await ctx.db.insert("users", {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: "moderator",
        disabled: false,
        createdAt: now,
      });
      await logAudit(ctx, {
        action: "moderator.create",
        targetTable: "users",
        targetId: userId,
      });
      return userId;
    }
  }
}

// ---------------------------------------------------------------------------
// Convex Auth
// ---------------------------------------------------------------------------

const scrypt = new Scrypt();

/**
 * Credentials sign-in only: accounts are created by the register actions below.
 * `audience: "moderation"` (sent by the moderation login form) accepts moderators only, and its
 * absence accepts everyone else, so each form refuses the other's accounts (DT-9). The client sets
 * it, so it is not a security boundary: moderator access rests on `requireRole` and the SMS code.
 */
const PasswordSignIn = ConvexCredentials({
  id: PASSWORD_PROVIDER,
  authorize: async (params, ctx) => {
    if (params.flow !== "signIn") throw new Error("Unsupported flow");
    const identifier =
      typeof params.identifier === "string" ? normalizeIdentifier(params.identifier) : null;
    const password = typeof params.password === "string" ? params.password : "";
    if (!identifier || password.length === 0) throw new Error("InvalidAccountId");

    const { user } = await retrieveAccount(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: identifier, secret: password },
    });
    const wantsModeration = params.audience === "moderation";
    if ((user.role === "moderator") !== wantsModeration) throw new Error("InvalidAccountId");
    return { userId: user._id };
  },
  crypto: {
    hashSecret: (secret) => scrypt.hash(secret),
    verifySecret: (secret, hash) => scrypt.verify(hash, secret),
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordSignIn],
  session: {
    totalDurationMs: appConfig.sessionTotalDays * DAY_MS,
    inactiveDurationMs: appConfig.sessionTotalDays * DAY_MS,
  },
  // About 5 failed attempts per 10 minutes (PARCOURS S03).
  signIn: { maxFailedAttempsPerHour: 30 },
  callbacks: {
    async createOrUpdateUser(genericCtx, { existingUserId, profile }) {
      if (existingUserId) return existingUserId;
      const ctx = genericCtx as unknown as MutationCtx;
      return insertNewUser(ctx, profile as unknown as NewAccountProfile);
    },
    async beforeSessionCreation(genericCtx, { userId }) {
      const ctx = genericCtx as unknown as MutationCtx;
      const user = await ctx.db.get(userId as Id<"users">);
      if (!user || user.disabled) throw new Error("AccountDisabled");
      await logAudit(ctx, {
        actorId: user._id,
        action: "auth.login",
        targetTable: "users",
        targetId: user._id,
        details: { role: user.role },
      });
    },
  },
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const accountExists = internalQuery({
  args: { identifier: v.string() },
  handler: async (ctx, { identifier }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", identifier),
      )
      .unique();
    return account !== null;
  },
});

/** A receipt uploaded for this signup's contact phone, with its stored size and type. */
export const signupReceipt = internalQuery({
  args: { fileId: v.id("_storage"), phone: v.string() },
  handler: async (ctx, { fileId, phone }) => {
    if (!(await findSignupUpload(ctx, fileId, phone))) return null;
    const file = await ctx.db.system.get(fileId);
    return file ? { size: file.size, contentType: file.contentType ?? null } : null;
  },
});

/** Checks a code without using it up (attempts are counted); returns its id for `claimOtp`. */
async function verifyOtpOrThrow(
  ctx: ActionCtx,
  args: { purpose: "donor_signup" | "org_contact" | "payout_number"; phone: string; code: string },
  field: string,
): Promise<Id<"otpCodes">> {
  const check = await ctx.runMutation(internal.otp.verify, args);
  if (!check.ok) throw appError("OTP_INVALID", otpErrorMessage(check), field);
  return check.otpId;
}

/** Convex Auth's createAccount, with its "already exists" error turned into CONFLICT. */
async function createPasswordAccount(
  ctx: ActionCtx,
  account: { id: string; secret?: string },
  profile: NewAccountProfile,
  conflict: { message: string; field: string },
) {
  try {
    return await createAccount(ctx, {
      provider: PASSWORD_PROVIDER,
      account,
      profile: profile as never,
    });
  } catch (error) {
    if (error instanceof Error && /already exists/.test(error.message)) {
      throw appError("CONFLICT", conflict.message, conflict.field);
    }
    throw error;
  }
}

function validateBloodProfile(input: BloodProfileInput | undefined): BloodProfileInput | undefined {
  if (!input) return undefined;
  if (input.region !== undefined && !isValidRegion(input.region)) {
    throw appError("VALIDATION", fr.errors.invalidRegion, "region");
  }
  if (input.commune !== undefined) {
    if (input.region === undefined || !isValidCommune(input.region, input.commune)) {
      throw appError("VALIDATION", fr.errors.invalidCommune, "commune");
    }
  }
  if (input.optIn && input.commune === undefined) {
    // Alerts target communes: an opted-in donor must give one (DT-26).
    throw appError("VALIDATION", fr.errors.invalidCommune, "commune");
  }
  return input;
}

const bloodProfileV = v.object({
  optIn: v.boolean(),
  bloodType: v.optional(bloodTypeV),
  region: v.optional(v.string()),
  commune: v.optional(v.string()),
  smsOptIn: v.boolean(),
});

/** Donor signup: the account exists only once the phone is verified by SMS code (DB-7). */
export const registerDonor = action({
  args: {
    name: v.string(),
    phone: v.string(),
    password: v.string(),
    otpCode: v.string(),
    bloodProfile: v.optional(bloodProfileV),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users">; role: "donor" }> => {
    const name = normalizeName(args.name);
    if (!name) throw appError("VALIDATION", fr.errors.invalidName, "name");
    const phone = normalizePhone(args.phone);
    if (!phone) throw appError("VALIDATION", fr.errors.invalidPhone, "phone");
    if (!isValidPassword(args.password, "donor")) {
      throw appError(
        "VALIDATION",
        fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.donor),
        "password",
      );
    }
    const bloodProfile = validateBloodProfile(args.bloodProfile);
    // The code comes first: only someone holding the phone learns whether it is registered.
    const otpId = await verifyOtpOrThrow(
      ctx,
      { purpose: "donor_signup", phone, code: args.otpCode.trim() },
      "otpCode",
    );
    const phoneTaken = { message: fr.errors.phoneTaken, field: "phone" };
    if (
      (await ctx.runQuery(internal.otp.donorExists, { phone })) ||
      (await ctx.runQuery(internal.auth.accountExists, { identifier: phone }))
    ) {
      throw appError("CONFLICT", phoneTaken.message, phoneTaken.field);
    }

    const profile: NewAccountProfile = {
      kind: "donor",
      name,
      phone,
      bloodProfile,
      otpIds: [otpId],
    };
    const { user } = await createPasswordAccount(
      ctx,
      { id: phone, secret: args.password },
      profile,
      phoneTaken,
    );
    return { userId: user._id as Id<"users">, role: "donor" };
  },
});

/**
 * Structure or hospital signup (phase 1, DB-15). Lands in `pending` until a moderator validates
 * the documents and, for structures, the payout account. Hospitals have no payout account (DT-5).
 *
 * SMS codes: `contactOtpCode` (`org_contact`) proves the responsible's phone, which receives the
 * login code (DT-33). A structure's payout number needs its own `payout_number` code, unless it is
 * the same number. The receipt must have been uploaded with the contact code (convex/files.ts).
 */
export const registerOrganization = action({
  args: {
    organizationName: v.string(),
    type: structureTypeV,
    region: v.string(),
    commune: v.string(),
    responsibleName: v.string(),
    responsiblePhone: v.string(),
    email: v.string(),
    password: v.string(),
    receiptNo: v.optional(v.string()),
    receiptFileId: v.id("_storage"),
    contactOtpCode: v.string(),
    payout: v.optional(
      v.object({
        method: methodV,
        accountNumber: v.string(),
        holderName: v.string(),
        /** Required unless the payout number is the responsible's phone. */
        otpCode: v.optional(v.string()),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ structureId: Id<"structures">; status: "pending"; message: string }> => {
    const organizationName = normalizeName(args.organizationName);
    if (!organizationName) throw appError("VALIDATION", fr.errors.invalidName, "organizationName");
    const responsibleName = normalizeName(args.responsibleName);
    if (!responsibleName) throw appError("VALIDATION", fr.errors.invalidName, "responsibleName");
    if (!isValidRegion(args.region))
      throw appError("VALIDATION", fr.errors.invalidRegion, "region");
    if (!isValidCommune(args.region, args.commune)) {
      throw appError("VALIDATION", fr.errors.invalidCommune, "commune");
    }
    const phone = normalizePhone(args.responsiblePhone);
    if (!phone) throw appError("VALIDATION", fr.errors.invalidPhone, "responsiblePhone");
    const email = normalizeEmail(args.email);
    if (!email) throw appError("VALIDATION", fr.errors.invalidEmail, "email");
    if (!isValidPassword(args.password, "organization")) {
      throw appError(
        "VALIDATION",
        fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.organization),
        "password",
      );
    }
    const receipt = await ctx.runQuery(internal.auth.signupReceipt, {
      fileId: args.receiptFileId,
      phone,
    });
    if (!receipt) throw appError("VALIDATION", fr.errors.receiptRequired, "receiptFileId");
    if (
      receipt.size > RECEIPT_MAX_BYTES ||
      !(RECEIPT_TYPES as readonly string[]).includes(receipt.contentType ?? "")
    ) {
      throw appError("VALIDATION", fr.errors.receiptInvalid, "receiptFileId");
    }

    const isHospital = args.type === HOSPITAL_TYPE;
    let payout: { method: Method; accountNumber: string; holderName: string } | undefined;
    if (!isHospital) {
      if (!args.payout) throw appError("VALIDATION", fr.errors.payoutRequired, "payout");
      const accountNumber = normalizePhone(args.payout.accountNumber);
      if (!accountNumber)
        throw appError("VALIDATION", fr.errors.invalidPhone, "payout.accountNumber");
      const holderName = normalizeName(args.payout.holderName);
      if (!holderName) throw appError("VALIDATION", fr.errors.invalidName, "payout.holderName");
      payout = { method: args.payout.method, accountNumber, holderName };
    }

    // Codes first: only someone holding the contact phone learns whether the email is taken.
    const otpIds = [
      await verifyOtpOrThrow(
        ctx,
        { purpose: "org_contact", phone, code: args.contactOtpCode.trim() },
        "contactOtpCode",
      ),
    ];
    if (payout && payout.accountNumber !== phone) {
      otpIds.push(
        await verifyOtpOrThrow(
          ctx,
          {
            purpose: "payout_number",
            phone: payout.accountNumber,
            code: (args.payout?.otpCode ?? "").trim(),
          },
          "payout.otpCode",
        ),
      );
    }
    const emailTaken = { message: fr.errors.emailTaken, field: "email" };
    if (await ctx.runQuery(internal.auth.accountExists, { identifier: email })) {
      throw appError("CONFLICT", emailTaken.message, emailTaken.field);
    }

    const profile: NewAccountProfile = {
      kind: "organization",
      role: isHospital ? "hospital" : "structure",
      name: responsibleName,
      email,
      phone,
      structure: {
        name: organizationName,
        type: args.type,
        region: args.region,
        commune: args.commune,
        receiptNo: args.receiptNo?.trim() || undefined,
        receiptFileId: args.receiptFileId,
        payout,
      },
      otpIds,
    };
    const { user } = await createPasswordAccount(
      ctx,
      { id: email, secret: args.password },
      profile,
      emailTaken,
    );
    const structureId = (user as Doc<"users">).structureId;
    if (!structureId) throw new Error("structure was not created");
    return { structureId, status: "pending", message: fr.auth.signup.sent.body };
  },
});

/** Creates a moderator account without a password (set through the email link). */
export async function createModeratorAccount(
  ctx: ActionCtx,
  input: { name: string; email: string; phone: string },
): Promise<Id<"users">> {
  const profile: NewAccountProfile = { kind: "moderator", ...input };
  const { user } = await createPasswordAccount(ctx, { id: input.email }, profile, {
    message: fr.errors.emailTaken,
    field: "email",
  });
  return user._id as Id<"users">;
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export interface MeView {
  user: {
    _id: Id<"users">;
    role: Role;
    name: string;
    phone?: string;
    email?: string;
  };
  profile: Doc<"donorProfiles"> | null;
  structure: {
    _id: Id<"structures">;
    name: string;
    type: StructureType;
    status: Doc<"structures">["status"];
    refusalReason?: string;
    suspendedAt?: number;
  } | null;
  /** Structures, hospitals and moderators need the SMS code on every login. */
  mfaRequired: boolean;
  mfaVerified: boolean;
}

/** The signed-in account, or null. Readable before the 2FA step, so the UI can ask for the code. */
export const me = query({
  args: {},
  handler: async (ctx): Promise<MeView | null> => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!userId || !sessionId) return null;
    const [user, session] = await Promise.all([ctx.db.get(userId), ctx.db.get(sessionId)]);
    if (!user || !session || user.disabled) return null;

    const profile =
      user.role === "donor"
        ? await ctx.db
            .query("donorProfiles")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .unique()
        : null;
    const structureDoc = user.structureId ? await ctx.db.get(user.structureId) : null;
    const mfaRequired = user.role !== "donor";
    return {
      user: {
        _id: user._id,
        role: user.role,
        name: user.name,
        phone: user.phone,
        email: user.email,
      },
      profile,
      structure: structureDoc && {
        _id: structureDoc._id,
        name: structureDoc.name,
        type: structureDoc.type,
        status: structureDoc.status,
        refusalReason: structureDoc.refusalReason,
        suspendedAt: structureDoc.suspendedAt,
      },
      mfaRequired,
      mfaVerified: !mfaRequired || session.mfaVerifiedAt !== undefined,
    };
  },
});

/** Donor blood profile (opt-in health data, owner only). */
export const updateBloodProfile = mutation({
  args: bloodProfileV,
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "donor");
    const input = validateBloodProfile(args);
    if (!input) throw appError("VALIDATION", fr.errors.required);
    const profile = await ctx.db
      .query("donorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const next = {
      bloodOptIn: input.optIn,
      bloodType: input.optIn ? input.bloodType : undefined,
      region: input.region,
      commune: input.commune,
      smsOptIn: input.optIn ? input.smsOptIn : false,
      updatedAt: Date.now(),
    };
    if (profile) await ctx.db.patch(profile._id, next);
    else await ctx.db.insert("donorProfiles", { userId: user._id, ...next });
    await logAudit(ctx, {
      actorId: user._id,
      action: input.optIn && !profile?.bloodOptIn ? "blood.optIn" : "profile.update",
      targetTable: "donorProfiles",
      targetId: user._id,
      details: { bloodOptIn: input.optIn },
    });
    return { ok: true };
  },
});
