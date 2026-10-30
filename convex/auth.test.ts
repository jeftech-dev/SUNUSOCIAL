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

async function storeReceipt(t: T, type = "application/pdf", bytes = 1024) {
  return t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
}

async function registerStructure(t: T, email = "contact@keurkhadija.test") {
  const receiptFileId = await storeReceipt(t);
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
    payout: {
      method: "wave",
      accountNumber: PAYOUT_PHONE,
      holderName: "Khadija Sow",
      otpCode: lastSmsCode(PAYOUT_PHONE),
    },
  });
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

  it("refuses a phone that is already registered", async () => {
    const t = setup();
    await registerDonor(t);
    advance(61_000);
    await expectAppError(
      t.action(api.otp.send, { purpose: "donor_signup", phone: DONOR_PHONE }),
      "CONFLICT",
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
  it("creates a pending structure with an SMS-verified payout account", async () => {
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
    });
  });

  it("creates a hospital without a payout account or SMS code", async () => {
    const t = setup();
    const receiptFileId = await storeReceipt(t, "image/png");
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

  it("requires the payout account, a valid receipt, 12-char passwords and a unique email", async () => {
    const t = setup();
    const base = {
      organizationName: "Foyer Jàmm",
      type: "Foyer" as const,
      region: "Saint-Louis",
      commune: "Saint-Louis",
      responsibleName: "Awa Sow",
      responsiblePhone: RESPONSIBLE_PHONE,
      email: "jamm@foyer.test",
      password: "un-mot-de-passe-long",
      receiptFileId: await storeReceipt(t),
    };
    await expectAppError(t.action(api.auth.registerOrganization, base), "VALIDATION");
    await expectAppError(
      t.action(api.auth.registerOrganization, { ...base, password: "trop-court" }),
      "VALIDATION",
    );
    await expectAppError(
      t.action(api.auth.registerOrganization, {
        ...base,
        type: "Hôpital (don de sang)",
        receiptFileId: await storeReceipt(t, "text/plain"),
      }),
      "VALIDATION",
    );
    await expectAppError(
      t.action(api.auth.registerOrganization, {
        ...base,
        type: "Hôpital (don de sang)",
        receiptFileId: await storeReceipt(t, "application/pdf", 6 * 1024 * 1024),
      }),
      "VALIDATION",
    );
    await registerStructure(t, "jamm@foyer.test");
    await expectAppError(
      t.action(api.auth.registerOrganization, { ...base, type: "Hôpital (don de sang)" }),
      "CONFLICT",
    );
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

    const receiptFileId = await storeReceipt(t);
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
