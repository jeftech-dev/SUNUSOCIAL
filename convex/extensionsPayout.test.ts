/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_MS } from "../lib/config";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

let logs: string[] = [];
function lastSmsCode(phone: string): string {
  const line = [...logs].reverse().find((l) => l.startsWith(`[SMS console] to ${phone}:`));
  const code = line?.match(/code est (\d{6})/)?.[1];
  if (!code) throw new Error(`no SMS code sent to ${phone}`);
  return code;
}

beforeEach(() => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

function errorData(error: unknown): { code?: string } {
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

async function storeFile(t: T): Promise<Id<"_storage">> {
  return t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(16)], { type: "application/pdf" })),
  );
}

async function structureCtx(t: T) {
  const receiptFileId = await storeFile(t);
  const structureId = await t.run((ctx) =>
    ctx.db.insert("structures", {
      name: "Foyer Jàmm",
      type: "Foyer",
      region: "Dakar",
      commune: "Rufisque",
      contactName: "Awa Diop",
      phone: "+221770000001",
      email: "jamm@example.sn",
      receiptFileId,
      payout: {
        method: "wave" as const,
        accountNumber: "+221770000001",
        holderName: "Awa Diop",
        phoneVerifiedAt: Date.now(),
        verifiedAt: Date.now(),
      },
      status: "approved" as const,
      onboardingPhase: 1 as const,
      createdAt: Date.now(),
    }),
  );
  const responsibleId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Awa Diop",
      role: "structure",
      structureId,
      phone: "+221770000001",
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId: responsibleId,
      expirationTime: Date.now() + DAY_MS,
      mfaVerifiedAt: Date.now(),
    }),
  );
  return {
    structureId,
    responsibleId,
    client: t.withIdentity({ subject: `${responsibleId}|${sessionId}` }),
  };
}

async function moderatorClient(t: T) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Mod", role: "moderator", disabled: false, createdAt: Date.now() }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
      mfaVerifiedAt: Date.now(),
    }),
  );
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

async function activeCause(t: T, structureId: Id<"structures">, deadline = Date.now() + 5 * DAY_MS) {
  const bannerFileId = await storeFile(t);
  return t.run((ctx) =>
    ctx.db.insert("causes", {
      structureId,
      title: "Cantine scolaire",
      description: "d",
      category: "Alimentation",
      bannerFileId,
      endType: "date",
      goalAmount: 1_000_000,
      deadline,
      extensionCount: 0,
      urgency: "normal",
      raised: 0,
      donorCount: 0,
      status: "active",
      submittedAt: Date.now(),
      approvedAt: Date.now(),
    }),
  );
}

const getCause = (t: T, id: Id<"causes">) => t.run((ctx) => ctx.db.get(id));
const getStructure = (t: T, id: Id<"structures">) => t.run((ctx) => ctx.db.get(id));

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

describe("extensions.request + decideExtension", () => {
  it("requests and approves a cause-deadline extension, notifying donors", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const deadline = Date.now() + 5 * DAY_MS;
    const causeId = await activeCause(t, s.structureId, deadline);
    const until = deadline + 10 * DAY_MS;

    const { requestId } = await s.client.mutation(api.extensions.request, {
      kind: "cause_deadline",
      targetId: causeId,
      requestedUntil: until,
      reason: "Collecte plus lente que prévu.",
    });
    const res = await mod.mutation(api.moderation.decideExtension, {
      requestId,
      decision: "approve",
    });
    expect(res.newDate).toBe(until);
    const cause = await getCause(t, causeId);
    expect(cause?.deadline).toBe(until);
    expect(cause?.extensionCount).toBe(1);
    await t.finishAllScheduledFunctions(() => {});
  });

  it("rejects a date beyond the max extension and a non-owner", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const deadline = Date.now() + 5 * DAY_MS;
    const causeId = await activeCause(t, s.structureId, deadline);
    await expectAppError(
      s.client.mutation(api.extensions.request, {
        kind: "cause_deadline",
        targetId: causeId,
        requestedUntil: deadline + 40 * DAY_MS, // > MAX_EXTENSION_DAYS (30)
        reason: "trop",
      }),
      "VALIDATION",
    );
    const other = await structureCtx(t);
    await expectAppError(
      other.client.mutation(api.extensions.request, {
        kind: "cause_deadline",
        targetId: causeId,
        requestedUntil: deadline + 5 * DAY_MS,
        reason: "pas à moi",
      }),
      "FORBIDDEN",
    );
  });

  it("refuses an extension with a reason", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const deadline = Date.now() + 5 * DAY_MS;
    const causeId = await activeCause(t, s.structureId, deadline);
    const { requestId } = await s.client.mutation(api.extensions.request, {
      kind: "cause_deadline",
      targetId: causeId,
      requestedUntil: deadline + 5 * DAY_MS,
      reason: "x",
    });
    await expectAppError(
      mod.mutation(api.moderation.decideExtension, { requestId, decision: "refuse" }),
      "VALIDATION",
    );
    await mod.mutation(api.moderation.decideExtension, {
      requestId,
      decision: "refuse",
      reason: "Pas de justification suffisante.",
    });
    expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "refused" });
    expect((await getCause(t, causeId))?.deadline).toBe(deadline); // unchanged
  });

  it("extends a proof deadline", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const causeId = await activeCause(t, s.structureId);
    const dueAt = Date.now() + 3 * DAY_MS;
    const deadlineId = await t.run((ctx) =>
      ctx.db.insert("proofDeadlines", {
        causeId,
        structureId: s.structureId,
        reason: "release",
        dueAt,
        enforced: true,
      }),
    );
    const until = dueAt + 7 * DAY_MS;
    const { requestId } = await s.client.mutation(api.extensions.request, {
      kind: "proof_deadline",
      targetId: deadlineId,
      requestedUntil: until,
      reason: "Besoin de plus de temps pour le dossier.",
    });
    await mod.mutation(api.moderation.decideExtension, { requestId, decision: "approve" });
    expect((await t.run((ctx) => ctx.db.get(deadlineId)))?.dueAt).toBe(until);
  });
});

// ---------------------------------------------------------------------------
// Payout-account change
// ---------------------------------------------------------------------------

const NEW_NUMBER = "+221760000003";

describe("structures.requestPayoutChange + decidePayoutAccount", () => {
  it("requests a change with an SMS code and blocks payouts until approved", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    await t.action(api.otp.send, { purpose: "payout_number", phone: NEW_NUMBER });

    await s.client.mutation(api.structures.requestPayoutChange, {
      payout: {
        method: "orange_money",
        accountNumber: NEW_NUMBER,
        holderName: "Awa Diop",
        otpCode: lastSmsCode(NEW_NUMBER),
      },
    });
    let structure = await getStructure(t, s.structureId);
    expect(structure?.payoutPending?.accountNumber).toBe(NEW_NUMBER);
    expect(structure?.payoutPending?.verifiedAt).toBeUndefined();

    // While a change is pending, a release is blocked (DT-24).
    const causeId = await activeCause(t, s.structureId);
    await t.run((ctx) =>
      ctx.db.insert("donations", {
        causeId,
        donorId: s.responsibleId,
        amount: 5100,
        fee: 100,
        platformFee: 0,
        net: 5000,
        method: "wave",
        provider: "mock",
        providerTxnId: "txn_block",
        status: "held",
        createdAt: Date.now(),
      }),
    );
    const release = await t.mutation(internal.payments.releaseCause, { causeId });
    expect(release.released).toBe(false);
    expect(await t.run((ctx) => ctx.db.query("payouts").collect())).toHaveLength(0);

    // Approve: pending moves to live, verified.
    await mod.mutation(api.moderation.decidePayoutAccount, {
      structureId: s.structureId,
      decision: "approve",
    });
    structure = await getStructure(t, s.structureId);
    expect(structure?.payoutPending).toBeUndefined();
    expect(structure?.payout?.accountNumber).toBe(NEW_NUMBER);
    expect(structure?.payout?.verifiedAt).toBeDefined();
  });

  it("rejects a wrong SMS code", async () => {
    const t = setup();
    const s = await structureCtx(t);
    await t.action(api.otp.send, { purpose: "payout_number", phone: NEW_NUMBER });
    await expectAppError(
      s.client.mutation(api.structures.requestPayoutChange, {
        payout: {
          method: "wave",
          accountNumber: NEW_NUMBER,
          holderName: "Awa Diop",
          otpCode: "000000",
        },
      }),
      "OTP_INVALID",
    );
  });

  it("refuses a change and keeps the old account", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    await t.action(api.otp.send, { purpose: "payout_number", phone: NEW_NUMBER });
    await s.client.mutation(api.structures.requestPayoutChange, {
      payout: {
        method: "orange_money",
        accountNumber: NEW_NUMBER,
        holderName: "Awa Diop",
        otpCode: lastSmsCode(NEW_NUMBER),
      },
    });
    await mod.mutation(api.moderation.decidePayoutAccount, {
      structureId: s.structureId,
      decision: "refuse",
      reason: "Le nom ne correspond pas.",
    });
    const structure = await getStructure(t, s.structureId);
    expect(structure?.payoutPending).toBeUndefined();
    expect(structure?.payout?.accountNumber).toBe("+221770000001"); // unchanged
  });
});

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

describe("moderation.queues (extensions + payout changes)", () => {
  it("lists pending extension and payout-change requests", async () => {
    const t = setup();
    const s = await structureCtx(t);
    const mod = await moderatorClient(t);
    const deadline = Date.now() + 5 * DAY_MS;
    const causeId = await activeCause(t, s.structureId, deadline);
    await s.client.mutation(api.extensions.request, {
      kind: "cause_deadline",
      targetId: causeId,
      requestedUntil: deadline + 5 * DAY_MS,
      reason: "x",
    });
    await t.action(api.otp.send, { purpose: "payout_number", phone: NEW_NUMBER });
    await s.client.mutation(api.structures.requestPayoutChange, {
      payout: {
        method: "orange_money",
        accountNumber: NEW_NUMBER,
        holderName: "Awa Diop",
        otpCode: lastSmsCode(NEW_NUMBER),
      },
    });

    const queues = await mod.query(api.moderation.queues, {});
    expect(queues.extensions.count).toBe(1);
    expect(queues.extensions.items[0]).toMatchObject({ kind: "cause_deadline", target: "Cantine scolaire" });
    expect(queues.payoutChanges.count).toBe(1);
    expect(queues.payoutChanges.items[0].accountNumber).toContain("0003");
  });
});
