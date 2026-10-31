// Payment provider selector (DB-1, DT-4): `PAYMENT_PROVIDER=naboopay | mock`. Production refuses
// `mock` (assertProvidersAllowed). Server-only: reads secrets from the environment.

import { assertProvidersAllowed, loadConfig } from "../config";
import { createMockProvider, type MockProvider } from "./mock";
import { createNaboopayProvider } from "./naboopay";
import type { PaymentProvider } from "./types";

type Env = Record<string, string | undefined>;

const DEV_SITE_URL = "http://localhost:3000";

/** The app's public origin (`SITE_URL`), without a trailing slash. Required in production. */
export function siteUrl(env: Env = process.env): string {
  const value = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (value) return value;
  if (loadConfig(env).appEnv === "production") {
    throw new Error("SITE_URL is required in production");
  }
  return DEV_SITE_URL;
}

export function getPaymentProvider(env: Env = process.env): PaymentProvider {
  const config = loadConfig(env);
  assertProvidersAllowed(config);
  if (config.paymentProvider === "mock") {
    return createMockProvider({
      siteUrl: siteUrl(env),
      webhookSecret: env.NABOOPAY_WEBHOOK_SECRET,
    });
  }
  return createNaboopayProvider({
    checkoutKey: env.NABOOPAY_CHECKOUT_KEY,
    webhookSecret: env.NABOOPAY_WEBHOOK_SECRET,
  });
}

/** The mock provider when it is the configured one outside production, else null. */
export function getMockProvider(env: Env = process.env): MockProvider | null {
  const config = loadConfig(env);
  if (config.paymentProvider !== "mock" || config.appEnv === "production") return null;
  return createMockProvider({ siteUrl: siteUrl(env), webhookSecret: env.NABOOPAY_WEBHOOK_SECRET });
}

export type { PaymentProvider } from "./types";
