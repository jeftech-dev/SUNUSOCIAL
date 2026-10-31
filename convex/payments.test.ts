/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { DAY_MS } from "../lib/config";
import { hmacSha256Hex } from "../lib/hmac";
import { computeFee } from "../lib/money";
import { MOCK_WEBHOOK_SECRET, mockOrderId } from "../lib/providers/mock";
import type { Method, Role } from "../lib/types";
import { NABOOPAY_WEBHOOK_PATH } from "./http";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

async function seeded() {
  const t = setup();
  await t.action(internal.seed.run, { fetchImages: false });
  return t;
}

/** A signed-in donor (phone verified, so refunds and SMS have a target). */
async function donor(t: T, phone = "+221770000001") {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Awa Diop",
      role: "donor" as Role,
      phone,
      phoneVerifiedAt: Date.now(),
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + DAY_MS }),
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
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

const activeCause = (t: T) =>
  t.run(async (ctx) => {
    const cause = await ctx.db
      .query("causes")
      .withIndex("by_status_deadline", (q) => q.eq("status", "active"))
      .first();
    if (!cause) throw new Error("no active cause");
    return cause;
  });

const getDonation = (t: T, id: Id<"donations">) => t.run((ctx) => ctx.db.get(id));

/** Signs and posts a NabooPay-style paid webhook (mock secret). */
async function postPaidWebhook(
  t: T,
  orderId: string,
  amount: number,
  fees: number,
  method: Method = "wave",
) {
  const body = JSON.stringify({
    order_id: orderId,
    amount,
    fees,
    transaction_status: "paid",
    selected_payment_method: method,
    currency: "XOF",
  });
  const signature = await hmacSha256Hex(MOCK_WEBHOOK_SECRET, body);
  return t.fetch(NABOOPAY_WEBHOOK_PATH, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", "X-Signature": signature },
  });
}

// ---------------------------------------------------------------------------
// createCheckout
// ---------------------------------------------------------------------------

describe("donations.createCheckout", () => {
  it("requires a signed-in donor", async () => {
    const t = await seeded();
    const cause = await activeCause(t);
    const args = { causeId: cause._id, amount: 5000, method: "wave" as Method };
    await expectAppError(t.action(api.donations.createCheckout, args), "UNAUTHENTICATED");
  });

  it("inserts a pending donation, computes the fee on the server, and stores the order_id", async () => {
    const t = await seeded();
    const { userId, client } = await donor(t);
    const cause = await activeCause(t);

    const result = await client.action(api.donations.createCheckout, {
      causeId: cause._id,
      amount: 5000,
      method: "wave",
    });
    expect(result.status).toBe("pending");
    expect(result.fee).toBe(computeFee(5000, "mock").fee);
    expect(result.net).toBe(5000 - result.fee);
    expect(result.checkoutUrl).toContain(`/paiement/simulation/${result.donationId}`);

    const donation = await getDonation(t, result.donationId);
    expect(donation).toMatchObject({
      status: "pending",
      donorId: userId,
      amount: 5000,
      method: "wave",
      provider: "mock",
      providerTxnId: mockOrderId(result.donationId),
    });
  });

  it("rejects an amount under the minimum", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    const cause = await activeCause(t);
    await expectAppError(
      client.action(api.donations.createCheckout, {
        causeId: cause._id,
        amount: 100,
        method: "wave",
      }),
      "VALIDATION",
    );
  });

  it("refuses a suspended structure's cause (DB-17)", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    const cause = await activeCause(t);
    await t.run((ctx) => ctx.db.patch(cause.structureId, { suspendedAt: Date.now() }));
    await expectAppError(
      client.action(api.donations.createCheckout, {
        causeId: cause._id,
        amount: 5000,
        method: "wave",
      }),
      "CONFLICT",
    );
  });

  it("refuses a cause past its deadline", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    const cause = await activeCause(t);
    await t.run((ctx) => ctx.db.patch(cause._id, { deadline: Date.now() - DAY_MS }));
    await expectAppError(
      client.action(api.donations.createCheckout, {
        causeId: cause._id,
        amount: 5000,
        method: "wave",
      }),
      "CONFLICT",
    );
  });
});

// ---------------------------------------------------------------------------
// Webhook + recordPayment
// ---------------------------------------------------------------------------

describe("payments webhook", () => {
  async function checkout(t: T, amount = 5000) {
    const { userId, client } = await donor(t);
    const cause = await activeCause(t);
    const result = await client.action(api.donations.createCheckout, {
      causeId: cause._id,
      amount,
      method: "wave",
    });
    return { userId, client, cause, ...result };
  }

  it("rejects a bad signature with 401 and records nothing", async () => {
    const t = await seeded();
    const { donationId } = await checkout(t);
    const orderId = mockOrderId(donationId);
    const body = JSON.stringify({
      order_id: orderId,
      amount: 5000,
      fees: 150,
      transaction_status: "paid",
    });
    const res = await t.fetch(NABOOPAY_WEBHOOK_PATH, {
      method: "POST",
      body,
      headers: { "X-Signature": "deadbeef" },
    });
    expect(res.status).toBe(401);
    expect((await getDonation(t, donationId))!.status).toBe("pending");
  });

  it("records a paid donation as held with the actual fee and bumps the cause", async () => {
    const t = await seeded();
    const { donationId, cause } = await checkout(t, 5000);
    const before = (await activeCause(t)).raised;

    const res = await postPaidWebhook(t, mockOrderId(donationId), 5000, 123);
    expect(res.status).toBe(200);

    const donation = (await getDonation(t, donationId))!;
    expect(donation.status).toBe("held");
    expect(donation.fee).toBe(123);
    expect(donation.net).toBe(5000 - 123);
    expect(donation.paidMethod).toBe("wave");
    // Money invariant on the stored row (DT-6).
    expect(donation.fee + donation.platformFee + donation.net).toBe(donation.amount);

    const after = await t.run((ctx) => ctx.db.get(cause._id));
    expect(after!.raised).toBe(before + 5000);
    expect(after!.donorCount).toBe(cause.donorCount + 1);
  });

  it("is idempotent: a duplicate delivery does not double-count", async () => {
    const t = await seeded();
    const { donationId, cause } = await checkout(t, 5000);
    await postPaidWebhook(t, mockOrderId(donationId), 5000, 150);
    const afterFirst = (await t.run((ctx) => ctx.db.get(cause._id)))!.raised;
    const res = await postPaidWebhook(t, mockOrderId(donationId), 5000, 150);
    expect(res.status).toBe(200);
    expect((await t.run((ctx) => ctx.db.get(cause._id)))!.raised).toBe(afterFirst);
  });

  it("leaves the donation pending on an amount mismatch", async () => {
    const t = await seeded();
    const { donationId } = await checkout(t, 5000);
    const res = await postPaidWebhook(t, mockOrderId(donationId), 6000, 180);
    expect(res.status).toBe(200);
    expect((await getDonation(t, donationId))!.status).toBe("pending");
  });

  it("acknowledges an unknown order_id without recording", async () => {
    const t = await seeded();
    const res = await postPaidWebhook(t, "mock_unknown", 5000, 150);
    expect(res.status).toBe(200);
  });

  it("counts a donor only once toward donorCount", async () => {
    const t = await seeded();
    const { userId, client } = await donor(t);
    const cause = await activeCause(t);
    for (const amount of [5000, 3000]) {
      const r = await client.action(api.donations.createCheckout, {
        causeId: cause._id,
        amount,
        method: "wave",
      });
      await postPaidWebhook(t, mockOrderId(r.donationId), amount, 90);
    }
    const after = (await t.run((ctx) => ctx.db.get(cause._id)))!;
    expect(after.raised).toBe(cause.raised + 8000);
    expect(after.donorCount).toBe(cause.donorCount + 1);
    void userId;
  });

  it("closes a goal cause when the goal is reached, accepting the full donation", async () => {
    const t = await seeded();
    const { userId, client } = await donor(t);
    const causeId = await t.run(async (ctx) => {
      const template = (await ctx.db.query("causes").first())!;
      const { _id, _creationTime, featuredAt, ...fields } = template;
      void _id;
      void _creationTime;
      void featuredAt;
      return ctx.db.insert("causes", {
        ...fields,
        title: "Objectif bientôt atteint",
        endType: "goal",
        goalAmount: 10000,
        raised: 8000,
        donorCount: 2,
      });
    });
    const r = await client.action(api.donations.createCheckout, {
      causeId,
      amount: 5000,
      method: "wave",
    });
    await postPaidWebhook(t, mockOrderId(r.donationId), 5000, 150);

    const cause = (await t.run((ctx) => ctx.db.get(causeId)))!;
    expect(cause.status).toBe("closed");
    expect(cause.closedAt).toBeTypeOf("number");
    expect(cause.raised).toBe(13000); // accepted in full, over the goal (S21)
    void userId;
  });

  it("flags a payment that arrives after the cause closed, without counting it (DB-18)", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    const cause = await activeCause(t);
    const r = await client.action(api.donations.createCheckout, {
      causeId: cause._id,
      amount: 5000,
      method: "wave",
    });
    // The cause closes before the payment is confirmed.
    await t.run((ctx) => ctx.db.patch(cause._id, { status: "closed", closedAt: Date.now() }));
    const raisedBefore = (await t.run((ctx) => ctx.db.get(cause._id)))!.raised;

    const res = await postPaidWebhook(t, mockOrderId(r.donationId), 5000, 150);
    expect(res.status).toBe(200);

    const donation = (await getDonation(t, r.donationId))!;
    expect(donation.status).toBe("held");
    expect(donation.lateRefundFlaggedAt).toBeTypeOf("number");
    expect((await t.run((ctx) => ctx.db.get(cause._id)))!.raised).toBe(raisedBefore);

    const note = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("kind"), "donation_late_refund"))
        .first(),
    );
    expect(note).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

describe("payments.simulatePayment", () => {
  async function checkout(t: T) {
    const { client } = await donor(t);
    const cause = await activeCause(t);
    const r = await client.action(api.donations.createCheckout, {
      causeId: cause._id,
      amount: 5000,
      method: "orange_money",
    });
    return { client, cause, donationId: r.donationId };
  }

  it("pays through the real webhook path and marks the donation held", async () => {
    const t = await seeded();
    const { client, donationId } = await checkout(t);
    const { redirectTo } = await client.action(api.payments.simulatePayment, {
      donationId,
      outcome: "paid",
    });
    expect(redirectTo).toBe(`/dons/${donationId}`);
    const donation = (await getDonation(t, donationId))!;
    expect(donation.status).toBe("held");
    expect(donation.paidMethod).toBe("orange_money");
  });

  it("cancels a donation and sends the donor back to the cause", async () => {
    const t = await seeded();
    const { client, cause, donationId } = await checkout(t);
    const { redirectTo } = await client.action(api.payments.simulatePayment, {
      donationId,
      outcome: "cancelled",
    });
    expect(redirectTo).toBe(`/causes/${cause._id}?paiement=echec`);
    expect((await getDonation(t, donationId))!.status).toBe("failed");
  });

  it("refuses someone else's donation", async () => {
    const t = await seeded();
    const { donationId } = await checkout(t);
    const { client: other } = await donor(t, "+221770000002");
    await expectAppError(
      other.action(api.payments.simulatePayment, { donationId, outcome: "paid" }),
      "NOT_FOUND",
    );
  });

  it("is refused in production", async () => {
    const t = await seeded();
    const { client, donationId } = await checkout(t);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "naboopay");
    vi.stubEnv("SMS_PROVIDER", "twilio");
    try {
      await expectAppError(
        client.action(api.payments.simulatePayment, { donationId, outcome: "paid" }),
        "FORBIDDEN",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

// ---------------------------------------------------------------------------
// Donor views
// ---------------------------------------------------------------------------

describe("donor views", () => {
  async function paidDonation(t: T, client: ReturnType<T["withIdentity"]>, amount: number) {
    const cause = await activeCause(t);
    const r = await client.action(api.donations.createCheckout, {
      causeId: cause._id,
      amount,
      method: "wave",
    });
    await postPaidWebhook(t, mockOrderId(r.donationId), amount, Math.round(amount * 0.03));
    return r.donationId;
  }

  it("donations.status returns the donor's own donation and hides others", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    const id = await paidDonation(t, client, 5000);
    const view = await client.query(api.donations.status, { donationId: id });
    expect(view).toMatchObject({ status: "held", amount: 5000, lateRefund: false });
    expect(view!.cause).not.toBeNull();

    const { client: other } = await donor(t, "+221770000009");
    expect(await other.query(api.donations.status, { donationId: id })).toBeNull();
    expect(await client.query(api.donations.status, { donationId: "not-an-id" })).toBeNull();
  });

  it("donations.mine lists the donor's history, newest first", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    await paidDonation(t, client, 5000);
    await paidDonation(t, client, 2000);
    const result = await client.query(api.donations.mine, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(2);
    expect(result.page[0].date).toBeGreaterThanOrEqual(result.page[1].date);
    expect(result.page[0].status).toBe("held");
    expect(result.page[0].refund.eligible).toBe(true);
  });

  it("donations.impact sums confirmed gifts and distinct causes", async () => {
    const t = await seeded();
    const { client } = await donor(t);
    await paidDonation(t, client, 5000);
    await paidDonation(t, client, 2000);
    const impact = await client.query(api.donations.impact, {});
    expect(impact).toEqual({ total: 7000, causeCount: 1, donationCount: 2 });
  });
});
