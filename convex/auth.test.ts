/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { requireOwner, requireRole } from "./lib/guards";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const DONOR_PHONE = "+221771234567";
const PAYOUT_PHONE = "+221781112233";
const RESPONSIBLE_PHONE = "+221765554433";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let logs: string[] = [];

/** The last 6-digit code sent by the console SMS provider to `phone`. */
function lastSmsCode(phone: string): string {
  const line = [...logs].reverse().find((l) => l.startsWith(`[SMS console] to ${phone}:`));
  const code = line?.match(/code est (\d{6})/)?.[1];
  if (!code) throw new Error(`no SMS code sent to ${phone}`);
  return code;
}

/** The last reset token emailed by the console email provider to `email`. */
function lastResetToken(email: string): string {
  const line = [...logs].reverse().find((l) => l.startsWith(`[email console] to ${email}:`));
  const token = line?.match(/token=([0-9a-f]+)/)?.[1];
  if (!token) throw new Error(`no reset link sent to ${email}`);
  return token;
}

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

async function registerDonor(t: T, phone = DONOR_PHONE, password = "motdepasse1") {
  await t.action(api.otp.send, { purpose: "donor_signup", phone });
  return t.action(api.auth.registerDonor, {
    name: "Aminata Diop",
    phone,
    password,
    otpCode: lastSmsCode(phone),
    bloodProfile: {
      optIn: true,
      bloodType: "O+",
      region: "Dakar",
      commune: "Médina",
      smsOptIn: true,
    },
  });
}

/** A minimal file with the PDF signature. */
function pdfBytes(size = 1024): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7"));
  return bytes;
}

/** POST /signup/receipt as the signup form does. */
function postReceipt(
  t: T,
  {
    phone,
    code,
    type = "application/pdf",
    body = pdfBytes(),
  }: {
    phone: string;
    code: string;
    type?: string;
    body?: Uint8Array;
  },
) {
  return t.fetch("/signup/receipt", {
    method: "POST",
    headers: {
      "Content-Type": type,
      "X-Signup-Phone": phone,
      "X-Signup-Code": code,
      Origin: "http://localhost:3000",
    },
    body: new Blob([body as BlobPart], { type }),
  });
}

/** Sends the contact code to `phone`, uploads a receipt with it, and returns both. */
async function startOrgSignup(t: T, phone = RESPONSIBLE_PHONE) {
  await t.action(api.otp.send, { purpose: "org_contact", phone });
  const contactOtpCode = lastSmsCode(phone);
  const response = await postReceipt(t, { phone, code: contactOtpCode });
  expect(response.status).toBe(200);
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return { contactOtpCode, receiptFileId: storageId };
}

/** A stored file that did not go through the signup endpoint. */
async function storeFile(t: T) {
  return t.run((ctx) =>
    ctx.storage.store(new Blob([pdfBytes() as BlobPart], { type: "application/pdf" })),
  );
}

async function registerStructure(t: T, email = "contact@keurkhadija.test") {
  const { contactOtpCode, receiptFileId } = await startOrgSignup(t);
  await t.action(api.otp.send, { purpose: "payout_number", phone: PAYOUT_PHONE });
  return t.action(api.auth.registerOrganization, {
    organizationName: "Pouponnière Keur Khadija",
    type: "Pouponnière",
    region: "Thiès",
    commune: "Mbour",
    responsibleName: "Khadija Sow",
    responsiblePhone: RESPONSIBLE_PHONE,
    email,
    password: "un-mot-de-passe-long",
    receiptFileId,
    contactOtpCode,
    payout: {
      method: "wave",
      accountNumber: PAYOUT_PHONE,
      holderName: "Khadija Sow",
      otpCode: lastSmsCode(PAYOUT_PHONE),
    },
  });
}

function wrongCode(code: string) {
  return code === "000000" ? "111111" : "000000";
}

function signIn(t: T, identifier: string, password: string, audience?: "moderation") {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", identifier, password, ...(audience ? { audience } : {}) },
  });
}

/** Opens a session for `userId` and returns a client acting as that session. */
async function asSession(t: T, userId: Id<"users">) {
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 }),
  );
  return { sessionId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

function errorData(error: unknown): { code?: string; field?: string | null } {
  const data = (error as { data?: unknown }).data;
  return typeof data === "string" ? JSON.parse(data) : ((data as object) ?? {});
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).not.toBeNull();
  expect(errorData(error).code).toBe(code);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Convex Auth signs session JWTs: give it a throwaway RSA key.
  const { privateKey } = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
  const base64 = btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n");
  process.env.JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
  process.env.CONVEX_SITE_URL = "https://test.convex.site";
  process.env.SITE_URL = "http://localhost:3000";
  process.env.MODERATION_SITE_URL = "http://moderation.localhost:3000";
});

beforeEach(() => {
  logs = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.SMS_DAILY_CAP;
});

const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));

// ---------------------------------------------------------------------------
// SMS codes
// ---------------------------------------------------------------------------

describe("otp", () => {
  it("sends a code by SMS and stores only its hash", async () => {
    const t = setup();
    const result = await t.action(api.otp.send, { purpose: "donor_signup", phone: "77 123 45 67" });
    expect(result.to).toBe("+221 77 ••• 45 67");
    const code = lastSmsCode(DONOR_PHONE);
    const rows = await t.run((ctx) => ctx.db.query("otpCodes").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toContain(code);
    expect(rows[0].expiresAt - Date.now()).toBe(10 * 60 * 1000);
  });

  it("refuses invalid numbers", async () => {
    const t = setup();
    await expectAppError(
      t.action(api.otp.send, { purpose: "donor_signup", phone: "123" }),
      "VALIDATION",
    );
    await expectAppError(
      t.action(api.otp.send, { purpose: "donor_signup", phone: "+221338001234" }),
      "VALIDATION",
    );
  });

  it("enforces 60 s between codes and 3 codes per 10 minutes", async () => {
    const t = setup();
    const send = () => t.action(api.otp.send, { purpose: "donor_signup", phone: DONOR_PHONE });
    await send();
    await expectAppError(send(), "RATE_LIMITED");
    advance(61_000);
    await send();
    advance(61_000);
    await send();
    advance(61_000);
    await expectAppError(send(), "RATE_LIMITED");
    advance(10 * 60 * 1000);
    await send();
  });

  it("caps codes at 10 per number and purpose in 24 hours", async () => {
    const t = setup();
    const send = () => t.action(api.otp.send, { purpose: "payout_number", phone: PAYOUT_PHONE });
    for (let i = 0; i < 10; i += 1) {
      await send();
      advance(4 * 60 * 1000);
    }
    await expectAppError(send(), "RATE_LIMITED");
    // Another purpose for the same number has its own budget.
    await t.action(api.otp.send, { purpose: "org_contact", phone: PAYOUT_PHONE });
    advance(24 * 60 * 60 * 1000);
    await send();
  });

  it("caps codes sent to signed-out people across all numbers (SMS_DAILY_CAP)", async () => {
    process.env.SMS_DAILY_CAP = "2";
    const t = setup();
    await t.action(api.otp.send, { purpose: "donor_signup", phone: "+221770000001" });
    await t.action(api.otp.send, { purpose: "org_contact", phone: "+221770000002" });
    const error = await t
      .action(api.otp.send, { purpose: "payout_number", phone: "+221770000003" })
      .catch((e: unknown) => e);
    expect(errorData(error).code).toBe("RATE_LIMITED");
    expect(logs.filter((l) => l.startsWith("[SMS console]"))).toHaveLength(2);
    // A reset for an unknown number sends nothing, so it is not refused.
    await t.action(api.otp.send, { purpose: "password_reset", phone: "+221770000004" });
    advance(24 * 60 * 60 * 1000);
    await t.action(api.otp.send, { purpose: "payout_number", phone: "+221770000003" });
  });

  it("stores a keyed hash, not a plain SHA-256 of the code", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "donor_signup", phone: DONOR_PHONE });
    const code = lastSmsCode(DONOR_PHONE);
    const plain = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`otp:donor_signup:${DONOR_PHONE}:${code}`),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const row = await t.run((ctx) => ctx.db.query("otpCodes").first());
    expect(row?.codeHash).not.toBe(plain);
  });

  it("counts wrong attempts and locks the code after 5", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "donor_signup", phone: DONOR_PHONE });
    const code = lastSmsCode(DONOR_PHONE);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i += 1) {
      expect(
        await t.mutation(internal.otp.consume, {
          purpose: "donor_signup",
          phone: DONOR_PHONE,
          code: wrong,
        }),
      ).toEqual({ ok: false, reason: "invalid" });
    }
    expect(
      await t.mutation(internal.otp.consume, {
        purpose: "donor_signup",
        phone: DONOR_PHONE,
        code: wrong,
      }),
    ).toEqual({ ok: false, reason: "locked" });
    // Even the right code is refused once locked.
    expect(
      await t.mutation(internal.otp.consume, { purpose: "donor_signup", phone: DONOR_PHONE, code }),
    ).toEqual({ ok: false, reason: "locked" });
  });

  it("expires codes after 10 minutes and accepts each code once", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "payout_number", phone: PAYOUT_PHONE });
    const code = lastSmsCode(PAYOUT_PHONE);
    advance(10 * 60 * 1000 + 1);
    expect(
      await t.mutation(internal.otp.consume, {
        purpose: "payout_number",
        phone: PAYOUT_PHONE,
        code,
      }),
    ).toEqual({ ok: false, reason: "expired" });

    await t.action(api.otp.send, { purpose: "payout_number", phone: PAYOUT_PHONE });
    const fresh = lastSmsCode(PAYOUT_PHONE);
    const consume = () =>
      t.mutation(internal.otp.consume, {
        purpose: "payout_number",
        phone: PAYOUT_PHONE,
        code: fresh,
      });
    expect(await consume()).toEqual({ ok: true });
    expect(await consume()).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not accept a code issued for another purpose", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "payout_number", phone: DONOR_PHONE });
    const code = lastSmsCode(DONOR_PHONE);
    expect(
      await t.mutation(internal.otp.consume, { purpose: "donor_signup", phone: DONOR_PHONE, code }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});

// ---------------------------------------------------------------------------
// Registration and sign-in
// ---------------------------------------------------------------------------

describe("donor signup and sign-in", () => {
  it("creates a verified donor with their blood profile and logs the signup", async () => {
    const t = setup();
    const { userId } = await registerDonor(t);
    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      expect(user).toMatchObject({ role: "donor", phone: DONOR_PHONE, disabled: false });
      expect(user?.phoneVerifiedAt).toBeDefined();
      const profile = await ctx.db
        .query("donorProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      expect(profile).toMatchObject({ bloodOptIn: true, bloodType: "O+", commune: "Médina" });
      const actions = (await ctx.db.query("auditLog").collect()).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(["auth.signup", "blood.optIn"]));
      // The password is hashed by Convex Auth, never stored on users.
      const account = await ctx.db.query("authAccounts").first();
      expect(account?.providerAccountId).toBe(DONOR_PHONE);
      expect(account?.secret).not.toContain("motdepasse1");
    });
  });

  it("refuses a wrong code without creating the account", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "donor_signup", phone: DONOR_PHONE });
    const wrong = lastSmsCode(DONOR_PHONE) === "000000" ? "111111" : "000000";
    await expectAppError(
      t.action(api.auth.registerDonor, {
        name: "Aminata Diop",
        phone: DONOR_PHONE,
        password: "motdepasse1",
        otpCode: wrong,
      }),
      "OTP_INVALID",
    );
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  it("does not reveal a registered phone: its owner gets an SMS instead of a code", async () => {
    const t = setup();
    await registerDonor(t);
    advance(61_000);
    logs = [];
    const result = await t.action(api.otp.send, { purpose: "donor_signup", phone: DONOR_PHONE });
    expect(result.to).toBe("+221 77 ••• 45 67");
    const sms = logs.filter((l) => l.startsWith(`[SMS console] to ${DONOR_PHONE}:`));
    expect(sms).toHaveLength(1);
    expect(sms[0]).toContain("existe déjà");
    expect(sms[0].split(": ").slice(1).join(": ")).not.toMatch(/\d{6}/);
  });

  it("answers CONFLICT only after a valid code, and keeps the code usable", async () => {
    const t = setup();
    const phone = "+221701112233";
    await t.action(api.otp.send, { purpose: "donor_signup", phone });
    const otpCode = lastSmsCode(phone);
    // Another signup for this number finishes in between.
    const accountId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Autre",
        phone,
        role: "donor",
        disabled: false,
        createdAt: Date.now(),
      });
      return ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: phone,
      });
    });
    const register = () =>
      t.action(api.auth.registerDonor, {
        name: "Aminata Diop",
        phone,
        password: "motdepasse1",
        otpCode,
      });
    await expectAppError(register(), "CONFLICT");
    const row = await t.run((ctx) => ctx.db.query("otpCodes").first());
    expect(row?.usedAt).toBeUndefined();

    // Once the number is free again, the same code still works, and only once.
    await t.run(async (ctx) => {
      const account = await ctx.db.get(accountId);
      await ctx.db.delete(account!.userId);
      await ctx.db.delete(accountId);
    });
    await register();
    advance(1000);
    await expectAppError(
      t.action(api.auth.registerDonor, {
        name: "Aminata Diop",
        phone: "+221701112244",
        password: "motdepasse1",
        otpCode,
      }),
      "OTP_INVALID",
    );
  });

  it("refuses short passwords and commune outside the region", async () => {
    const t = setup();
    await expectAppError(
      t.action(api.auth.registerDonor, {
        name: "Aminata Diop",
        phone: DONOR_PHONE,
        password: "court",
        otpCode: "123456",
      }),
      "VALIDATION",
    );
    await expectAppError(
      t.action(api.auth.registerDonor, {
        name: "Aminata Diop",
        phone: DONOR_PHONE,
        password: "motdepasse1",
        otpCode: "123456",
        bloodProfile: { optIn: true, region: "Thiès", commune: "Médina", smsOptIn: false },
      }),
      "VALIDATION",
    );
  });

  it("signs a donor in with phone + password, logs the login, and refuses a wrong password", async () => {
    const t = setup();
    await registerDonor(t);
    const result = await signIn(t, "77 123 45 67", "motdepasse1");
    expect(result.tokens?.token).toBeTruthy();
    const logins = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("action"), "auth.login"))
        .collect(),
    );
    expect(logins).toHaveLength(1);
    await expect(signIn(t, DONOR_PHONE, "mauvais-mot")).rejects.toThrow();
  });

  it("keeps donors off the moderation sign-in and refuses disabled accounts", async () => {
    const t = setup();
    const { userId } = await registerDonor(t);
    await expect(signIn(t, DONOR_PHONE, "motdepasse1", "moderation")).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch(userId, { disabled: true }));
    await expect(signIn(t, DONOR_PHONE, "motdepasse1")).rejects.toThrow(/AccountDisabled/);
  });

  it("lets a donor update their blood profile", async () => {
    const t = setup();
    const { userId } = await registerDonor(t);
    const { client } = await asSession(t, userId);
    await client.mutation(api.auth.updateBloodProfile, {
      optIn: false,
      region: "Dakar",
      commune: "Pikine",
      smsOptIn: true,
    });
    const me = await client.query(api.auth.me, {});
    expect(me?.profile).toMatchObject({ bloodOptIn: false, commune: "Pikine", smsOptIn: false });
    expect(me?.profile?.bloodType).toBeUndefined();
  });
});

describe("organisation signup", () => {
  it("creates a pending structure with SMS-verified contact phone and payout account", async () => {
    const t = setup();
    const { structureId, status } = await registerStructure(t);
    expect(status).toBe("pending");
    await t.run(async (ctx) => {
      const structure = await ctx.db.get(structureId);
      expect(structure).toMatchObject({ status: "pending", onboardingPhase: 1, region: "Thiès" });
      expect(structure?.payout).toMatchObject({ method: "wave", accountNumber: PAYOUT_PHONE });
      expect(structure?.payout?.phoneVerifiedAt).toBeDefined();
      expect(structure?.payout?.verifiedAt).toBeUndefined();
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "contact@keurkhadija.test"))
        .unique();
      expect(user).toMatchObject({ role: "structure", structureId, phone: RESPONSIBLE_PHONE });
      expect(user?.phoneVerifiedAt).toBeDefined();
      // The receipt is attached: nothing is left for the cleanup job.
      expect(await ctx.db.query("signupUploads").collect()).toHaveLength(0);
      const codes = await ctx.db.query("otpCodes").collect();
      expect(codes.every((c) => c.usedAt !== undefined)).toBe(true);
    });
  });

  it("needs a single code when the payout number is the contact phone", async () => {
    const t = setup();
    const { contactOtpCode, receiptFileId } = await startOrgSignup(t);
    const { structureId } = await t.action(api.auth.registerOrganization, {
      organizationName: "Daara Serigne Fallou",
      type: "Orphelinat",
      region: "Diourbel",
      commune: "Touba",
      responsibleName: "Modou Fall",
      responsiblePhone: RESPONSIBLE_PHONE,
      email: "daara@fallou.test",
      password: "un-mot-de-passe-long",
      receiptFileId,
      contactOtpCode,
      payout: {
        method: "orange_money",
        accountNumber: RESPONSIBLE_PHONE,
        holderName: "Modou Fall",
      },
    });
    const structure = await t.run((ctx) => ctx.db.get(structureId));
    expect(structure?.payout?.phoneVerifiedAt).toBeDefined();
  });

  it("creates a hospital with a verified contact phone and no payout account", async () => {
    const t = setup();
    const { contactOtpCode, receiptFileId } = await startOrgSignup(t);
    const { structureId } = await t.action(api.auth.registerOrganization, {
      organizationName: "Hôpital régional de Thiès",
      type: "Hôpital (don de sang)",
      region: "Thiès",
      commune: "Thiès",
      responsibleName: "Dr Mame Diarra Sarr",
      responsiblePhone: RESPONSIBLE_PHONE,
      email: "transfusion@hrt.test",
      password: "un-mot-de-passe-long",
      receiptFileId,
      contactOtpCode,
    });
    const structure = await t.run((ctx) => ctx.db.get(structureId));
    expect(structure?.payout).toBeUndefined();
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "transfusion@hrt.test"))
        .unique(),
    );
    expect(user?.role).toBe("hospital");
  });

  it("checks the codes, the receipt, the payout account, 12-char passwords and a unique email", async () => {
    const t = setup();
    const { contactOtpCode, receiptFileId } = await startOrgSignup(t);
    const base = {
      organizationName: "Foyer Jàmm",
      type: "Hôpital (don de sang)" as const,
      region: "Saint-Louis",
      commune: "Saint-Louis",
      responsibleName: "Awa Sow",
      responsiblePhone: RESPONSIBLE_PHONE,
      email: "jamm@foyer.test",
      password: "un-mot-de-passe-long",
      receiptFileId,
      contactOtpCode,
    };
    const register = (
      overrides: Partial<Omit<typeof base, "type">> & {
        type?: "Foyer";
        payout?: { method: "wave"; accountNumber: string; holderName: string };
      } = {},
    ) => t.action(api.auth.registerOrganization, { ...base, ...overrides });
    await expectAppError(register({ type: "Foyer" }), "VALIDATION"); // no payout account
    await expectAppError(register({ password: "trop-court" }), "VALIDATION");
    await expectAppError(register({ contactOtpCode: wrongCode(contactOtpCode) }), "OTP_INVALID");
    // A file that did not go through the signup endpoint, or was uploaded for another phone.
    await expectAppError(register({ receiptFileId: await storeFile(t) }), "VALIDATION");
    await expectAppError(
      register({ responsiblePhone: "+221775550000", contactOtpCode }),
      "VALIDATION",
    );
    // A different payout number needs its own code.
    await expectAppError(
      register({
        type: "Foyer",
        payout: { method: "wave", accountNumber: PAYOUT_PHONE, holderName: "Awa Sow" },
      }),
      "OTP_INVALID",
    );

    // The email is checked after the codes, which stay usable after a CONFLICT.
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Autre",
        email: "jamm@foyer.test",
        role: "structure",
        disabled: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "jamm@foyer.test",
      });
    });
    await expectAppError(register(), "CONFLICT");
    await register({ email: "jamm2@foyer.test" });
  });
});

describe("signup receipt upload", () => {
  it("needs the contact phone's code and doesn't use it up", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "org_contact", phone: RESPONSIBLE_PHONE });
    const code = lastSmsCode(RESPONSIBLE_PHONE);
    const refused = await postReceipt(t, { phone: RESPONSIBLE_PHONE, code: wrongCode(code) });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("OTP_INVALID");
    const noCode = await postReceipt(t, { phone: "+221775550000", code });
    expect(noCode.status).toBe(403);

    const ok = await postReceipt(t, { phone: RESPONSIBLE_PHONE, code });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    const rows = await t.run((ctx) => ctx.db.query("otpCodes").collect());
    expect(rows[0].usedAt).toBeUndefined();
    expect(rows[0].attempts).toBe(1);
  });

  it("checks the size and the real file type before storing", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "org_contact", phone: RESPONSIBLE_PHONE });
    const code = lastSmsCode(RESPONSIBLE_PHONE);
    const post = (type: string, body: Uint8Array) =>
      postReceipt(t, { phone: RESPONSIBLE_PHONE, code, type, body });
    expect((await post("text/plain", pdfBytes())).status).toBe(415);
    // Declared as a PDF, but an HTML page.
    expect((await post("application/pdf", new TextEncoder().encode("<html>"))).status).toBe(415);
    expect((await post("application/pdf", pdfBytes(5 * 1024 * 1024 + 1))).status).toBe(413);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(0);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    expect((await post("image/png", png)).status).toBe(200);
  });

  it("limits uploads per phone, with no shared counter", async () => {
    const t = setup();
    await t.action(api.otp.send, { purpose: "org_contact", phone: RESPONSIBLE_PHONE });
    const code = lastSmsCode(RESPONSIBLE_PHONE);
    for (let i = 0; i < 5; i += 1) {
      expect((await postReceipt(t, { phone: RESPONSIBLE_PHONE, code })).status).toBe(200);
    }
    expect((await postReceipt(t, { phone: RESPONSIBLE_PHONE, code })).status).toBe(429);
    // Someone else signing up at the same time is not affected.
    await startOrgSignup(t, PAYOUT_PHONE);
  });

  it("answers the CORS preflight for the app's origin only", async () => {
    const t = setup();
    const preflight = (origin: string) =>
      t.fetch("/signup/receipt", { method: "OPTIONS", headers: { Origin: origin } });
    expect(
      (await preflight("http://localhost:3000")).headers.get("Access-Control-Allow-Origin"),
    ).toBe("http://localhost:3000");
    expect(
      (await preflight("https://evil.example")).headers.get("Access-Control-Allow-Origin"),
    ).toBeNull();
  });

  it("deletes the files of signups abandoned for 24 hours", async () => {
    const t = setup();
    await registerStructure(t);
    const { receiptFileId } = await startOrgSignup(t, PAYOUT_PHONE);
    advance(25 * 60 * 60 * 1000);
    expect(await t.mutation(internal.files.purgeAbandonedUploads, {})).toEqual({ deleted: 1 });
    await t.run(async (ctx) => {
      expect(await ctx.db.system.get(receiptFileId)).toBeNull();
      expect(await ctx.db.query("signupUploads").collect()).toHaveLength(0);
      // The attached receipt stays.
      const structure = await ctx.db.query("structures").first();
      expect(await ctx.db.system.get(structure!.receiptFileId)).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Login 2FA and guards
// ---------------------------------------------------------------------------

describe("login 2FA", () => {
  it("unlocks an organisation session only with the SMS code sent to the account phone", async () => {
    const t = setup();
    await registerStructure(t);
    const userId = (await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "contact@keurkhadija.test"))
        .unique(),
    ))!._id;
    const { client, sessionId } = await asSession(t, userId);

    expect(await client.query(api.auth.me, {})).toMatchObject({
      mfaRequired: true,
      mfaVerified: false,
    });
    // Org-only functions are locked until the code is entered.
    await expectAppError(
      client.run((ctx) => requireRole(ctx, "structure")),
      "MFA_REQUIRED",
    );

    await client.action(api.otp.send, { purpose: "login_2fa" });
    const code = lastSmsCode(RESPONSIBLE_PHONE);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await client.mutation(api.otp.verifyLogin, { code: wrong })).toMatchObject({
      ok: false,
      error: { code: "OTP_INVALID" },
    });
    expect(await client.mutation(api.otp.verifyLogin, { code })).toEqual({ ok: true });
    expect(await client.query(api.auth.me, {})).toMatchObject({ mfaVerified: true });
    await client.run((ctx) => requireRole(ctx, "structure"));
    await expectAppError(
      client.run((ctx) => requireRole(ctx, "moderator")),
      "FORBIDDEN",
    );
    const session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.mfaVerifiedAt).toBeDefined();
  });

  it("keeps the code already sent when the 2FA step reloads within 60 s", async () => {
    const t = setup();
    await registerStructure(t);
    const userId = (await t.run((ctx) => ctx.db.query("users").first()))!._id;
    const { client } = await asSession(t, userId);
    logs = [];
    await client.action(api.otp.send, { purpose: "login_2fa" });
    const code = lastSmsCode(RESPONSIBLE_PHONE);
    await client.action(api.otp.send, { purpose: "login_2fa" });
    expect(logs.filter((l) => l.startsWith("[SMS console]"))).toHaveLength(1);
    expect(await client.mutation(api.otp.verifyLogin, { code })).toEqual({ ok: true });
  });

  it("does not let a code unlock another session", async () => {
    const t = setup();
    await registerStructure(t);
    const userId = (await t.run((ctx) => ctx.db.query("users").first()))!._id;
    const first = await asSession(t, userId);
    const second = await asSession(t, userId);
    await first.client.action(api.otp.send, { purpose: "login_2fa" });
    const code = lastSmsCode(RESPONSIBLE_PHONE);
    expect(await second.client.mutation(api.otp.verifyLogin, { code })).toMatchObject({
      ok: false,
    });
  });

  it("does not send 2FA codes to donors", async () => {
    const t = setup();
    const { userId } = await registerDonor(t);
    const { client } = await asSession(t, userId);
    await expectAppError(client.action(api.otp.send, { purpose: "login_2fa" }), "FORBIDDEN");
    expect(await client.query(api.auth.me, {})).toMatchObject({
      mfaRequired: false,
      mfaVerified: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Password reset and moderators
// ---------------------------------------------------------------------------

describe("password reset", () => {
  it("resets a donor password with an SMS code and ends their sessions", async () => {
    const t = setup();
    const { userId } = await registerDonor(t);
    await asSession(t, userId);
    advance(61_000);
    await t.action(api.otp.send, { purpose: "password_reset", phone: DONOR_PHONE });
    await t.action(api.passwordReset.resetWithSmsCode, {
      phone: DONOR_PHONE,
      code: lastSmsCode(DONOR_PHONE),
      newPassword: "nouveau-mdp",
    });
    expect(await t.run((ctx) => ctx.db.query("authSessions").collect())).toHaveLength(0);
    await expect(signIn(t, DONOR_PHONE, "motdepasse1")).rejects.toThrow();
    expect((await signIn(t, DONOR_PHONE, "nouveau-mdp")).tokens?.token).toBeTruthy();
  });

  it("answers the same for an unknown number, without sending an SMS", async () => {
    const t = setup();
    const result = await t.action(api.otp.send, { purpose: "password_reset", phone: DONOR_PHONE });
    expect(result.to).toBe("+221 77 ••• 45 67");
    expect(logs.some((l) => l.startsWith("[SMS console]"))).toBe(false);
  });

  it("resets an organisation password with a single-use email link", async () => {
    const t = setup();
    await registerStructure(t);
    expect(await t.action(api.passwordReset.requestEmailReset, { email: "nobody@x.test" })).toEqual(
      {
        ok: true,
      },
    );
    expect(logs.some((l) => l.startsWith("[email console]"))).toBe(false);

    await t.action(api.passwordReset.requestEmailReset, { email: "Contact@KeurKhadija.test" });
    const token = lastResetToken("contact@keurkhadija.test");
    await t.action(api.passwordReset.resetWithToken, {
      token,
      newPassword: "nouveau-mot-de-passe",
    });
    await expectAppError(
      t.action(api.passwordReset.resetWithToken, { token, newPassword: "encore-un-autre-mdp" }),
      "VALIDATION",
    );
    expect(
      (await signIn(t, "contact@keurkhadija.test", "nouveau-mot-de-passe")).tokens?.token,
    ).toBeTruthy();
  });

  it("refuses expired reset links", async () => {
    const t = setup();
    await registerStructure(t);
    await t.action(api.passwordReset.requestEmailReset, { email: "contact@keurkhadija.test" });
    const token = lastResetToken("contact@keurkhadija.test");
    advance(30 * 60 * 1000 + 1);
    await expectAppError(
      t.action(api.passwordReset.resetWithToken, { token, newPassword: "nouveau-mot-de-passe" }),
      "VALIDATION",
    );
  });
});

describe("admin.createModerator", () => {
  it("creates a moderator who sets a password by email and signs in on the moderation audience only", async () => {
    const t = setup();
    await t.action(internal.admin.createModerator, {
      name: "Fatou Ndiaye",
      email: "fatou@sunusocial.test",
      phone: "+221770001122",
    });
    const line = logs.find((l) => l.startsWith("[email console] to fatou@sunusocial.test"));
    expect(line).toContain("http://moderation.localhost:3000/mot-de-passe/nouveau?token=");

    await t.action(api.passwordReset.resetWithToken, {
      token: lastResetToken("fatou@sunusocial.test"),
      newPassword: "mot-de-passe-moderateur",
    });
    await expect(signIn(t, "fatou@sunusocial.test", "mot-de-passe-moderateur")).rejects.toThrow();
    expect(
      (await signIn(t, "fatou@sunusocial.test", "mot-de-passe-moderateur", "moderation")).tokens
        ?.token,
    ).toBeTruthy();

    await expectAppError(
      t.action(internal.admin.createModerator, {
        name: "Fatou Ndiaye",
        email: "fatou@sunusocial.test",
        phone: "+221770001122",
      }),
      "CONFLICT",
    );
  });
});

describe("guards", () => {
  it("rejects anonymous callers and checks ownership", async () => {
    const t = setup();
    await expectAppError(
      t.run((ctx) => requireRole(ctx, "donor")),
      "UNAUTHENTICATED",
    );

    const { structureId } = await registerStructure(t);
    const userId = (await t.run((ctx) => ctx.db.query("users").first()))!._id;
    const { client, sessionId } = await asSession(t, userId);
    await t.run((ctx) => ctx.db.patch(sessionId, { mfaVerifiedAt: Date.now() }));
    await client.run((ctx) => requireOwner(ctx, structureId));

    const receiptFileId = await storeFile(t);
    const other = await t.run((ctx) =>
      ctx.db.insert("structures", {
        name: "Autre",
        type: "Foyer",
        region: "Dakar",
        commune: "Médina",
        contactName: "X",
        phone: RESPONSIBLE_PHONE,
        email: "x@y.test",
        receiptFileId,
        status: "approved",
        onboardingPhase: 1,
        createdAt: Date.now(),
      }),
    );
    await expectAppError(
      client.run((ctx) => requireOwner(ctx, other)),
      "FORBIDDEN",
    );

    await t.run((ctx) => ctx.db.patch(userId, { disabled: true }));
    await expectAppError(
      client.run((ctx) => requireRole(ctx, "structure")),
      "FORBIDDEN",
    );
  });
});
