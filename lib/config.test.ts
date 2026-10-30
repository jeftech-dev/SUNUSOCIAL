import { describe, expect, it } from "vitest";

import { assertProvidersAllowed, ConfigError, DEFAULTS, loadConfig } from "./config";

describe("loadConfig", () => {
  it("falls back to the DECISIONS.md §3 defaults", () => {
    expect(loadConfig({})).toEqual(DEFAULTS);
    expect(DEFAULTS).toMatchObject({
      minDonation: 500,
      platformFeeRate: 0,
      maxCauseDurationDays: 30,
      maxExtensionDays: 30,
      proofDueDays: 7,
      sessionTotalDays: 7,
      requirePhase2BeforePayout: false,
      paymentProvider: "mock",
      smsProvider: "console",
      smsDailyCap: 1000,
    });
  });

  it("treats empty values as unset", () => {
    expect(loadConfig({ MIN_DONATION: "", PAYMENT_PROVIDER: "  " })).toEqual(DEFAULTS);
  });

  it("reads overrides from the environment", () => {
    const config = loadConfig({
      APP_ENV: "preview",
      PAYMENT_PROVIDER: "naboopay",
      SMS_PROVIDER: "someprovider",
      SMS_DAILY_CAP: "250",
      MIN_DONATION: "1000",
      PLATFORM_FEE_RATE: "0.02",
      REQUIRE_PHASE2_BEFORE_PAYOUT: "true",
    });
    expect(config).toMatchObject({
      appEnv: "preview",
      paymentProvider: "naboopay",
      smsProvider: "someprovider",
      smsDailyCap: 250,
      minDonation: 1000,
      platformFeeRate: 0.02,
      requirePhase2BeforePayout: true,
    });
  });

  it("rejects invalid values", () => {
    expect(() => loadConfig({ MIN_DONATION: "abc" })).toThrow(ConfigError);
    expect(() => loadConfig({ MIN_DONATION: "499.5" })).toThrow(ConfigError);
    expect(() => loadConfig({ PROOF_DUE_DAYS: "0" })).toThrow(ConfigError);
    expect(() => loadConfig({ SMS_DAILY_CAP: "-1" })).toThrow(ConfigError);
    expect(() => loadConfig({ PLATFORM_FEE_RATE: "1" })).toThrow(ConfigError);
    expect(() => loadConfig({ PAYMENT_PROVIDER: "sycapay" })).toThrow(ConfigError);
    expect(() => loadConfig({ APP_ENV: "staging" })).toThrow(ConfigError);
    expect(() => loadConfig({ REQUIRE_PHASE2_BEFORE_PAYOUT: "yes" })).toThrow(ConfigError);
  });
});

describe("assertProvidersAllowed", () => {
  it("allows mock and console outside production", () => {
    expect(() => assertProvidersAllowed(loadConfig({ APP_ENV: "preview" }))).not.toThrow();
  });

  it("refuses the mock payment provider in production", () => {
    const config = loadConfig({ APP_ENV: "production", SMS_PROVIDER: "real" });
    expect(() => assertProvidersAllowed(config)).toThrow(/PAYMENT_PROVIDER=mock/);
  });

  it("refuses the console SMS provider in production", () => {
    const config = loadConfig({ APP_ENV: "production", PAYMENT_PROVIDER: "naboopay" });
    expect(() => assertProvidersAllowed(config)).toThrow(/SMS_PROVIDER=console/);
  });

  it("accepts real providers in production", () => {
    const config = loadConfig({
      APP_ENV: "production",
      PAYMENT_PROVIDER: "naboopay",
      SMS_PROVIDER: "real",
    });
    expect(() => assertProvidersAllowed(config)).not.toThrow();
  });
});
