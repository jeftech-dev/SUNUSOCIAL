// Mock payment provider for development, preview and tests (DB-1). Refused in production.
// The checkout page is the app's own simulator (/paiement/simulation/<donationId>), whose "Payer"
// button signs a webhook body with `sign` and sends it through the real webhook handler, so the
// signature check and `payments.recordPayment` run exactly as with NabooPay.

import { hmacSha256Hex, timingSafeEqual } from "../hmac";
import {
  PaymentProviderError,
  type CheckoutInput,
  type CheckoutResult,
  type PaymentProvider,
  type PayoutInfo,
  type PayoutInput,
  type PayoutListItem,
  type PayoutResult,
  type TransactionInfo,
} from "./types";

/** Development-only signing key, used when NABOOPAY_WEBHOOK_SECRET is unset. */
export const MOCK_WEBHOOK_SECRET = "sunusocial-dev-mock-webhook-secret";

/** Default mock `main` balance (FCFA): large, so the balance check passes unless a test lowers it. */
const MOCK_DEFAULT_BALANCE = 1_000_000_000;

/**
 * Mock payouts never move real money. Behaviour is driven by `MOCK_PAYOUT_*` env vars so tests can
 * exercise every DT-4 branch deterministically without a stateful provider. The mock is refused in
 * production, so reading the environment here is safe.
 */
function mockPayoutEnv(env: Record<string, string | undefined> = process.env) {
  return {
    /** ok | pending | conflict | timeout | server_error | fail */
    mode: env.MOCK_PAYOUT_MODE ?? "ok",
    balance: Number(env.MOCK_PAYOUT_BALANCE ?? MOCK_DEFAULT_BALANCE),
    /** What getPayout reports (pending-review polling). */
    getStatus: env.MOCK_PAYOUT_GET_STATUS ?? "completed",
    /** When set, listPayouts returns one completed item of this amount (reconciliation). */
    reconcileAmount: env.MOCK_PAYOUT_RECONCILE_AMOUNT,
  };
}

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

    async payout(input: PayoutInput): Promise<PayoutResult> {
      const { mode } = mockPayoutEnv();
      switch (mode) {
        case "pending":
          return { orderId: mockPayoutOrderId(input), status: "pending" };
        case "conflict":
          throw new PaymentProviderError("mock: a payout is already in progress", 409);
        case "timeout":
          // No HTTP status: a network timeout. The worker must mark it `unknown`, never resend.
          throw new PaymentProviderError("mock: payout request timed out");
        case "server_error":
          throw new PaymentProviderError("mock: payout failed server-side", 503);
        case "fail":
          throw new PaymentProviderError("mock: invalid payout request", 400);
        default:
          return { orderId: mockPayoutOrderId(input), status: "completed" };
      }
    },

    async getPayout(): Promise<PayoutInfo> {
      const { getStatus } = mockPayoutEnv();
      const status =
        getStatus === "pending" ||
        getStatus === "completed" ||
        getStatus === "failed" ||
        getStatus === "cancelled"
          ? getStatus
          : "completed";
      return { status };
    },

    async listPayouts({ recipientPhone }): Promise<PayoutListItem[]> {
      const { reconcileAmount } = mockPayoutEnv();
      if (reconcileAmount === undefined) return [];
      return [
        { orderId: `mock_recon_${recipientPhone}`, amount: Number(reconcileAmount), status: "completed" },
      ];
    },

    async getBalance(): Promise<number> {
      return Math.trunc(mockPayoutEnv().balance);
    },
  };
}

/** A deterministic mock payout order id, so repeated calls in a test are stable. */
function mockPayoutOrderId(input: PayoutInput): string {
  return `mockpay_${input.method}_${input.phone}_${input.amount}`;
}
