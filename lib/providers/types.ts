// The payment provider interface (DT-3, DT-4). Feature code talks to this, never to NabooPay
// directly; `PAYMENT_PROVIDER` picks the implementation (lib/providers/index.ts).
// Payouts (`payout`, `getPayout`, `listPayouts`, `getBalance`) join the interface with the payout
// worker in Sprint 6.

import { METHODS, type Method, type Provider } from "../types";

/** NabooPay transaction states. `paid_and_blocked` (escrow) also means paid. */
export const TRANSACTION_STATUSES = [
  "pending",
  "paid",
  "paid_and_blocked",
  "cancelled",
  "refunded",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export function isPaidStatus(status: string): status is "paid" | "paid_and_blocked" {
  return status === "paid" || status === "paid_and_blocked";
}

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  /** E.164; the donor's verified phone. */
  phone?: string;
}

export interface CheckoutInput {
  donationId: string;
  /** Integer FCFA, the gross donation. */
  amount: number;
  /** The method picked in the donation modal; the checkout page offers only this one (DT-3). */
  method: Method;
  /** Shown on the checkout page as the product name. */
  causeTitle: string;
  customer: CheckoutCustomer;
  /** Plain URLs, no percent-encoded characters (NabooPay rule). */
  successUrl: string;
  errorUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  /** NabooPay `order_id`, stored on the donation before the donor is redirected. */
  providerTxnId: string;
}

export interface TransactionInfo {
  status: TransactionStatus;
  amount: number;
  /** NabooPay's actual fee, once paid. */
  fees?: number;
  /** `selected_payment_method`, once paid. */
  method?: Method;
}

export interface PaymentProvider {
  readonly name: Provider;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Checks `X-Signature` (hex HMAC-SHA256 of the raw body) in constant time. */
  verifyWebhook(rawBody: string, signature: string | null): Promise<boolean>;
  getTransaction(orderId: string): Promise<TransactionInfo>;
  /** Cancels an unpaid transaction (abandoned for 2 h). */
  cancelTransaction(orderId: string): Promise<void>;
}

/** A failed provider call. `status` is the HTTP status, absent for network errors and timeouts. */
export class PaymentProviderError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "PaymentProviderError";
    this.status = status;
  }
}

/** The fields of a webhook body we use. Only the first three exist in both webhook versions. */
export interface WebhookPayment {
  orderId: string;
  status: string;
  amount: number;
  fees?: number;
  method?: Method;
}

function isMethod(value: unknown): value is Method {
  return typeof value === "string" && (METHODS as readonly string[]).includes(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Reads a parsed webhook body (v2, or legacy v1 with `payment_method`). Returns null when a
 * required field is missing or malformed.
 */
export function parseWebhookPayload(body: unknown): WebhookPayment | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.order_id !== "string" || b.order_id === "") return null;
  if (typeof b.transaction_status !== "string") return null;
  if (!isAmount(b.amount)) return null;
  const method = b.selected_payment_method ?? b.payment_method;
  return {
    orderId: b.order_id,
    status: b.transaction_status,
    amount: b.amount,
    fees: isAmount(b.fees) ? b.fees : undefined,
    method: isMethod(method) ? method : undefined,
  };
}

/** Splits a full name into NabooPay's first and last name ("Awa Diop Ndiaye" → "Awa", "Diop Ndiaye"). */
export function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Donateur", lastName: "SUNUSOCIAL" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
