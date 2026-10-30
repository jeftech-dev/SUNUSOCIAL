import { afterEach, describe, expect, it } from "vitest";

import { hashOtp } from "./crypto";

describe("hashOtp", () => {
  afterEach(() => {
    delete process.env.OTP_HASH_SECRET;
    delete process.env.APP_ENV;
  });

  it("depends on the server key", async () => {
    process.env.OTP_HASH_SECRET = "first-key";
    const first = await hashOtp("donor_signup", "+221771234567", "123456");
    process.env.OTP_HASH_SECRET = "second-key";
    expect(await hashOtp("donor_signup", "+221771234567", "123456")).not.toBe(first);
  });

  it("requires OTP_HASH_SECRET in production", async () => {
    process.env.APP_ENV = "production";
    await expect(hashOtp("donor_signup", "+221771234567", "123456")).rejects.toThrow(
      /OTP_HASH_SECRET/,
    );
  });
});
