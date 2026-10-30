// Typed access to the product rules and provider switches (docs/DECISIONS.md §3).
//
// Values come from the environment and fall back to the documented defaults. They are read
// on the server (Convex functions, Next.js server code), which is authoritative. In the browser
// only NEXT_PUBLIC_* variables exist, so client code sees the defaults: use it for previews,
// never for decisions.

import { PROVIDERS, type Provider } from "./types";

export const APP_ENVS = ["development", "preview", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface Config {
  appEnv: AppEnv;
  /** `naboopay` in production, `mock` in development and preview (DB-1). */
  paymentProvider: Provider;
  /** `console` logs codes in development and preview; production needs a real provider (DT-29). */
  smsProvider: string;
  /**
   * Most SMS codes sent per 24 h to people who are not signed in (signup, payout number, reset).
   * Interim cost guard until the board sets the SMS budget (BOARD_QUESTIONS.md Q1).
   */
  smsDailyCap: number;
  /** Interim, to be studied with the board (DB-14). */
  minDonation: number;
  /** 0 until the revenue model is decided. */
  platformFeeRate: number;
  /** Decided (DB-11). */
  maxCauseDurationDays: number;
  /** Technical cap per extension request (DT-30). */
  maxExtensionDays: number;
  /** Decided (DB-12). */
  proofDueDays: number;
  /** Decided (DB-8). */
  sessionTotalDays: number;
  /** Waiting on the phase 2 definition (DT-31). */
  requirePhase2BeforePayout: boolean;
}

export const DEFAULTS: Config = {
  appEnv: "development",
  paymentProvider: "mock",
  smsProvider: "console",
  smsDailyCap: 1000,
  minDonation: 500,
  platformFeeRate: 0,
  maxCauseDurationDays: 30,
  maxExtensionDays: 30,
  proofDueDays: 7,
  sessionTotalDays: 7,
  requirePhase2BeforePayout: false,
};

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function raw(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function positiveInt(env: Env, name: string, fallback: number): number {
  const value = raw(env, name);
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new ConfigError(`${name} must be a positive integer, got "${value}"`);
  }
  return n;
}

function rate(env: Env, name: string, fallback: number): number {
  const value = raw(env, name);
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n >= 1) {
    throw new ConfigError(`${name} must be a rate in [0, 1), got "${value}"`);
  }
  return n;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const value = raw(env, name);
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ConfigError(`${name} must be "true" or "false", got "${value}"`);
}

function oneOf<T extends string>(env: Env, name: string, allowed: readonly T[], fallback: T): T {
  const value = raw(env, name);
  if (value === undefined) return fallback;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ConfigError(`${name} must be one of ${allowed.join(", ")}, got "${value}"`);
  }
  return value as T;
}

/** Parses and validates the configuration. Throws `ConfigError` on an invalid value. */
export function loadConfig(env: Env): Config {
  return {
    appEnv: oneOf(env, "APP_ENV", APP_ENVS, DEFAULTS.appEnv),
    paymentProvider: oneOf(env, "PAYMENT_PROVIDER", PROVIDERS, DEFAULTS.paymentProvider),
    smsProvider: raw(env, "SMS_PROVIDER") ?? DEFAULTS.smsProvider,
    smsDailyCap: positiveInt(env, "SMS_DAILY_CAP", DEFAULTS.smsDailyCap),
    minDonation: positiveInt(env, "MIN_DONATION", DEFAULTS.minDonation),
    platformFeeRate: rate(env, "PLATFORM_FEE_RATE", DEFAULTS.platformFeeRate),
    maxCauseDurationDays: positiveInt(
      env,
      "MAX_CAUSE_DURATION_DAYS",
      DEFAULTS.maxCauseDurationDays,
    ),
    maxExtensionDays: positiveInt(env, "MAX_EXTENSION_DAYS", DEFAULTS.maxExtensionDays),
    proofDueDays: positiveInt(env, "PROOF_DUE_DAYS", DEFAULTS.proofDueDays),
    sessionTotalDays: positiveInt(env, "SESSION_TOTAL_DAYS", DEFAULTS.sessionTotalDays),
    requirePhase2BeforePayout: bool(
      env,
      "REQUIRE_PHASE2_BEFORE_PAYOUT",
      DEFAULTS.requirePhase2BeforePayout,
    ),
  };
}

/**
 * Production must use real providers: the `mock` payment provider and the `console` SMS
 * provider are refused (DT-2, DT-4, DT-29).
 */
export function assertProvidersAllowed(config: Config): void {
  if (config.appEnv !== "production") return;
  if (config.paymentProvider === "mock") {
    throw new ConfigError("PAYMENT_PROVIDER=mock is not allowed in production");
  }
  if (config.smsProvider === "console") {
    throw new ConfigError("SMS_PROVIDER=console is not allowed in production");
  }
}

/** The configuration of the current runtime. */
export const config: Config = loadConfig(typeof process === "undefined" ? {} : process.env);

/** Milliseconds in one day, for the *Days settings. */
export const DAY_MS = 24 * 60 * 60 * 1000;
