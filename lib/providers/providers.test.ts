import { describe, expect, it, vi } from "vitest";

import { hmacSha256Hex } from "../hmac";
import { getMockProvider, getPaymentProvider, siteUrl } from "./index";
import { createMockProvider, MOCK_WEBHOOK_SECRET, mockOrderId } from "./mock";
import { createNaboopayProvider, NABOOPAY_BASE_URL } from "./naboopay";
import {
  isPaidStatus,
  parseWebhookPayload,
  PaymentProviderError,
  splitFullName,
  type CheckoutInput,
} from "./types";

const SECRET = "whsec_test";
const BODY =
  '{"order_id":"550e8400-e29b-41d4-a716-446655440000","amount":5000,"fees":150,"transaction_status":"paid","selected_payment_method":"wave","currency":"XOF"}';

const CHECKOUT: CheckoutInput = {
  donationId: "don123",
  amount: 5000,
  method: "wave",
  causeTitle: "Lait infantile pour 40 bébés",
  customer: { firstName: "Awa", lastName: "Diop", phone: "+221771234567" },
  successUrl: "https://sunusocial.sn/dons/don123",
  errorUrl: "https://sunusocial.sn/causes/cau1?paiement=echec",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseWebhookPayload", () => {
  it("reads a v2 body", () => {
    expect(parseWebhookPayload(JSON.parse(BODY))).toEqual({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      status: "paid",
      amount: 5000,
      fees: 150,
      method: "wave",
    });
  });

  it("reads a legacy v1 body without fees", () => {
    expect(
      parseWebhookPayload({
        order_id: "o1",
        amount: 1000,
        currency: "XOF",
        transaction_status: "paid",
        payment_method: "orange_money",
      }),
    ).toEqual({
      orderId: "o1",
      status: "paid",
      amount: 1000,
      fees: undefined,
      method: "orange_money",
    });
  });

  it("rejects bodies without the required fields", () => {
    expect(parseWebhookPayload(null)).toBeNull();
    expect(parseWebhookPayload("x")).toBeNull();
    expect(parseWebhookPayload({ amount: 1, transaction_status: "paid" })).toBeNull();
    expect(
      parseWebhookPayload({ order_id: "o", amount: 1.5, transaction_status: "paid" }),
    ).toBeNull();
    expect(
      parseWebhookPayload({ order_id: "o", amount: "5000", transaction_status: "paid" }),
    ).toBeNull();
    expect(parseWebhookPayload({ order_id: "o", amount: 1 })).toBeNull();
  });

  it("ignores unknown methods and malformed fees", () => {
    expect(
      parseWebhookPayload({
        order_id: "o",
        amount: 1000,
        transaction_status: "paid",
        fees: -3,
        selected_payment_method: "card",
      }),
    ).toMatchObject({ fees: undefined, method: undefined });
  });
});

describe("isPaidStatus", () => {
  it("treats paid and paid_and_blocked as paid", () => {
    expect(isPaidStatus("paid")).toBe(true);
    expect(isPaidStatus("paid_and_blocked")).toBe(true);
    expect(isPaidStatus("pending")).toBe(false);
    expect(isPaidStatus("completed")).toBe(false);
  });
});

describe("splitFullName", () => {
  it("splits first and last names", () => {
    expect(splitFullName("Awa Diop Ndiaye")).toEqual({ firstName: "Awa", lastName: "Diop Ndiaye" });
    expect(splitFullName("  Moussa  ")).toEqual({ firstName: "Moussa", lastName: "Moussa" });
    expect(splitFullName("")).toEqual({ firstName: "Donateur", lastName: "SUNUSOCIAL" });
  });
});

describe("NabooPay provider", () => {
  it("creates a checkout with the picked method, merchant-side fees and no escrow", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        order_id: "ord-1",
        checkout_url: "https://checkout.naboopay.com/checkout/ord-1",
        transaction_status: "pending",
      }),
    );
    const provider = createNaboopayProvider({ checkoutKey: "key", fetch: fetchMock });
    await expect(provider.createCheckout(CHECKOUT)).resolves.toEqual({
      providerTxnId: "ord-1",
      checkoutUrl: "https://checkout.naboopay.com/checkout/ord-1",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${NABOOPAY_BASE_URL}/transactions`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(JSON.parse(init.body as string)).toEqual({
      method_of_payment: ["wave"],
      products: [{ name: "Lait infantile pour 40 bébés", price: 5000, quantity: 1 }],
      customer: { first_name: "Awa", last_name: "Diop", phone: "+221771234567" },
      success_url: CHECKOUT.successUrl,
      error_url: CHECKOUT.errorUrl,
      fees_customer_side: false,
      is_escrow: false,
      is_merchant: false,
    });
  });

  it("reports NabooPay errors with their status", async () => {
    const provider = createNaboopayProvider({
      checkoutKey: "key",
      fetch: async () =>
        jsonResponse(403, { error: "Monthly transaction limit of 200000 XOF reached" }),
    });
    const error = await provider.createCheckout(CHECKOUT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentProviderError);
    expect((error as PaymentProviderError).status).toBe(403);
    expect((error as Error).message).toContain("200000 XOF");
  });

  it("reports network failures", async () => {
    const provider = createNaboopayProvider({
      checkoutKey: "key",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    const error = await provider.createCheckout(CHECKOUT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentProviderError);
    expect((error as PaymentProviderError).status).toBeUndefined();
  });

  it("refuses to call NabooPay without a key", async () => {
    const fetchMock = vi.fn();
    const provider = createNaboopayProvider({ fetch: fetchMock });
    await expect(provider.createCheckout(CHECKOUT)).rejects.toThrow("NABOOPAY_CHECKOUT_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a transaction", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        order_id: "ord-1",
        amount: 5000,
        fees: 100,
        transaction_status: "paid_and_blocked",
        selected_payment_method: "orange_money",
      }),
    );
    const provider = createNaboopayProvider({ checkoutKey: "key", fetch: fetchMock });
    await expect(provider.getTransaction("ord-1")).resolves.toEqual({
      status: "paid_and_blocked",
      amount: 5000,
      fees: 100,
      method: "orange_money",
    });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      `${NABOOPAY_BASE_URL}/transactions/ord-1`,
    );
  });

  it("cancels a transaction with DELETE", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { message: "ok" }));
    const provider = createNaboopayProvider({ checkoutKey: "key", fetch: fetchMock });
    await provider.cancelTransaction("ord-1");
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe("DELETE");
  });

  it("verifies X-Signature over the raw body", async () => {
    const provider = createNaboopayProvider({ webhookSecret: SECRET });
    const signature = await hmacSha256Hex(SECRET, BODY);
    expect(await provider.verifyWebhook(BODY, signature)).toBe(true);
    expect(await provider.verifyWebhook(BODY, signature.toUpperCase())).toBe(true);
    expect(await provider.verifyWebhook(BODY.replace("5000", "6000"), signature)).toBe(false);
    expect(await provider.verifyWebhook(BODY, null)).toBe(false);
    expect(await provider.verifyWebhook(BODY, "00")).toBe(false);
    // Re-serialised JSON is a different byte string: it must not verify.
    expect(await provider.verifyWebhook(JSON.stringify(JSON.parse(BODY), null, 1), signature)).toBe(
      false,
    );
  });

  it("refuses every webhook without a secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = createNaboopayProvider({});
    expect(await provider.verifyWebhook(BODY, await hmacSha256Hex("any", BODY))).toBe(false);
  });
});

describe("mock provider", () => {
  const provider = createMockProvider({ siteUrl: "http://localhost:3000" });

  it("sends the donor to the in-app simulator", async () => {
    await expect(provider.createCheckout(CHECKOUT)).resolves.toEqual({
      providerTxnId: mockOrderId("don123"),
      checkoutUrl: "http://localhost:3000/paiement/simulation/don123",
    });
  });

  it("verifies what it signs, with the dev secret by default", async () => {
    const signature = await provider.sign(BODY);
    expect(signature).toBe(await hmacSha256Hex(MOCK_WEBHOOK_SECRET, BODY));
    expect(await provider.verifyWebhook(BODY, signature)).toBe(true);
    expect(await provider.verifyWebhook(`${BODY} `, signature)).toBe(false);
    expect(await provider.verifyWebhook(BODY, null)).toBe(false);
  });
});

describe("provider selection", () => {
  it("uses the mock outside production by default", () => {
    expect(getPaymentProvider({}).name).toBe("mock");
    expect(getMockProvider({})).not.toBeNull();
  });

  it("uses NabooPay when configured", () => {
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "naboopay" }).name).toBe("naboopay");
    expect(getMockProvider({ PAYMENT_PROVIDER: "naboopay" })).toBeNull();
  });

  it("refuses the mock in production", () => {
    expect(() =>
      getPaymentProvider({ APP_ENV: "production", PAYMENT_PROVIDER: "mock", SMS_PROVIDER: "x" }),
    ).toThrow("PAYMENT_PROVIDER=mock");
    expect(
      getMockProvider({ APP_ENV: "production", PAYMENT_PROVIDER: "mock", SMS_PROVIDER: "x" }),
    ).toBeNull();
  });

  it("reads SITE_URL without a trailing slash", () => {
    expect(siteUrl({ SITE_URL: "https://sunusocial.sn/" })).toBe("https://sunusocial.sn");
    expect(siteUrl({})).toBe("http://localhost:3000");
    expect(() => siteUrl({ APP_ENV: "production" })).toThrow("SITE_URL");
  });
});
