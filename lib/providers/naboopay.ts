// NabooPay API v2 adapter (DB-1, DT-3). Spec: .claude/skills/naboopay, notes in ARCHITECTURE.md §3.4.
// Runs on the server only (Convex actions): it holds the checkout key and the webhook secret.

import { hmacSha256Hex, timingSafeEqual } from "../hmac";
import { METHODS, type Method } from "../types";
import {
  PaymentProviderError,
  TRANSACTION_STATUSES,
  type CheckoutInput,
  type CheckoutResult,
  type PaymentProvider,
  type TransactionInfo,
  type TransactionStatus,
} from "./types";

export const NABOOPAY_BASE_URL = "https://api.naboopay.com/api/v2";
/** Well under NabooPay's own limits; a checkout that takes longer is reported as failed. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Product names are free text; keep them readable on the checkout page. */
const MAX_PRODUCT_NAME = 100;

export interface NaboopayOptions {
  /** `NABOOPAY_CHECKOUT_KEY`, scope `checkout` (DT-4). */
  checkoutKey?: string;
  /** `NABOOPAY_WEBHOOK_SECRET`, from the webhook's page in the NabooPay dashboard. */
  webhookSecret?: string;
  /** Injected in tests. */
  fetch?: typeof fetch;
  baseUrl?: string;
}

function asMethod(value: unknown): Method | undefined {
  return typeof value === "string" && (METHODS as readonly string[]).includes(value)
    ? (value as Method)
    : undefined;
}

function asStatus(value: unknown): TransactionStatus {
  if (typeof value === "string" && (TRANSACTION_STATUSES as readonly string[]).includes(value)) {
    return value as TransactionStatus;
  }
  throw new PaymentProviderError(`unexpected transaction_status ${String(value)}`);
}

export function createNaboopayProvider(options: NaboopayOptions): PaymentProvider {
  const doFetch = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? NABOOPAY_BASE_URL;

  async function request(method: "GET" | "POST" | "DELETE", path: string, body?: unknown) {
    const key = options.checkoutKey?.trim();
    if (!key) throw new PaymentProviderError("NABOOPAY_CHECKOUT_KEY is not set");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new PaymentProviderError(
        `NabooPay ${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : text.slice(0, 200);
      throw new PaymentProviderError(
        `NabooPay ${method} ${path} → ${response.status}: ${message}`,
        response.status,
      );
    }
    return (data ?? {}) as Record<string, unknown>;
  }

  return {
    name: "naboopay",

    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      const data = await request("POST", "/transactions", {
        method_of_payment: [input.method],
        products: [
          { name: input.causeTitle.slice(0, MAX_PRODUCT_NAME), price: input.amount, quantity: 1 },
        ],
        customer: {
          first_name: input.customer.firstName,
          last_name: input.customer.lastName,
          ...(input.customer.phone ? { phone: input.customer.phone } : {}),
        },
        success_url: input.successUrl,
        error_url: input.errorUrl,
        // Fees are deducted from what SUNUSOCIAL receives; funds are held in the app ledger (DT-3).
        fees_customer_side: false,
        is_escrow: false,
        is_merchant: false,
      });
      if (typeof data.order_id !== "string" || typeof data.checkout_url !== "string") {
        throw new PaymentProviderError("NabooPay checkout answer lacks order_id or checkout_url");
      }
      return { providerTxnId: data.order_id, checkoutUrl: data.checkout_url };
    },

    async verifyWebhook(rawBody, signature) {
      const secret = options.webhookSecret?.trim();
      if (!secret) {
        console.error("NABOOPAY_WEBHOOK_SECRET is not set: every webhook is refused");
        return false;
      }
      if (!signature) return false;
      const expected = await hmacSha256Hex(secret, rawBody);
      return timingSafeEqual(expected, signature.trim().toLowerCase());
    },

    async getTransaction(orderId): Promise<TransactionInfo> {
      const data = await request("GET", `/transactions/${encodeURIComponent(orderId)}`);
      const amount = data.amount;
      if (typeof amount !== "number" || !Number.isSafeInteger(amount)) {
        throw new PaymentProviderError("NabooPay transaction answer lacks amount");
      }
      const fees = data.fees;
      return {
        status: asStatus(data.transaction_status),
        amount,
        fees:
          typeof fees === "number" && Number.isSafeInteger(fees) && fees >= 0 ? fees : undefined,
        method: asMethod(data.selected_payment_method),
      };
    },

    async cancelTransaction(orderId) {
      await request("DELETE", `/transactions/${encodeURIComponent(orderId)}`);
    },
  };
}
