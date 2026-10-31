// Mock payment provider for development, preview and tests (DB-1). Refused in production.
// The checkout page is the app's own simulator (/paiement/simulation/<donationId>), whose "Payer"
// button signs a webhook body with `sign` and sends it through the real webhook handler, so the
// signature check and `payments.recordPayment` run exactly as with NabooPay.

import { hmacSha256Hex, timingSafeEqual } from "../hmac";
import type { CheckoutInput, CheckoutResult, PaymentProvider, TransactionInfo } from "./types";

/** Development-only signing key, used when NABOOPAY_WEBHOOK_SECRET is unset. */
export const MOCK_WEBHOOK_SECRET = "sunusocial-dev-mock-webhook-secret";

export const SIMULATOR_PATH = "/paiement/simulation";

export interface MockProvider extends PaymentProvider {
  /** The `X-Signature` the mock expects for `rawBody`. */
  sign(rawBody: string): Promise<string>;
}

export function mockOrderId(donationId: string): string {
  return `mock_${donationId}`;
}

export function createMockProvider(options: {
  siteUrl: string;
  webhookSecret?: string;
}): MockProvider {
  const secret = options.webhookSecret?.trim() || MOCK_WEBHOOK_SECRET;
  const sign = (rawBody: string) => hmacSha256Hex(secret, rawBody);

  return {
    name: "mock",
    sign,

    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      return {
        providerTxnId: mockOrderId(input.donationId),
        checkoutUrl: `${options.siteUrl}${SIMULATOR_PATH}/${input.donationId}`,
      };
    },

    async verifyWebhook(rawBody, signature) {
      if (!signature) return false;
      return timingSafeEqual(await sign(rawBody), signature.trim().toLowerCase());
    },

    // The mock never learns about payments by polling: the simulator drives the webhook. A
    // donation nobody pays in the simulator stays pending, and the 2-hour cleanup cancels it.
    async getTransaction(): Promise<TransactionInfo> {
      return { status: "pending", amount: 0 };
    },

    async cancelTransaction() {},
  };
}
