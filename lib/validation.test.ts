import { describe, expect, it } from "vitest";

import {
  isOtpFormat,
  isValidPassword,
  maskPhone,
  normalizeEmail,
  normalizeIdentifier,
  normalizeName,
  normalizePhone,
} from "./validation";

describe("normalizePhone", () => {
  it("accepts Senegalese mobile numbers in common formats", () => {
    for (const input of [
      "771234567",
      "77 123 45 67",
      "+221 77 123 45 67",
      "00221771234567",
      "221-77-123-45-67",
    ]) {
      expect(normalizePhone(input)).toBe("+221771234567");
    }
  });

  it("refuses landlines, foreign and malformed numbers", () => {
    for (const input of [
      "338001234",
      "+33612345678",
      "77123456",
      "7712345678",
      "77 12a 45 67",
      "",
    ]) {
      expect(normalizePhone(input)).toBeNull();
    }
  });
});

describe("maskPhone", () => {
  it("hides the middle digits", () => {
    expect(maskPhone("+221771234567")).toBe("+221 77 ••• 45 67");
    expect(maskPhone("nope")).toBe("•••");
  });
});

describe("normalizeEmail / normalizeIdentifier", () => {
  it("lower-cases and trims emails, refuses invalid ones", () => {
    expect(normalizeEmail("  Contact@KeurKhadija.SN ")).toBe("contact@keurkhadija.sn");
    expect(normalizeEmail("contact@keurkhadija")).toBeNull();
    expect(normalizeEmail("contact keurkhadija.sn")).toBeNull();
  });

  it("routes identifiers to email or phone", () => {
    expect(normalizeIdentifier("A@B.sn")).toBe("a@b.sn");
    expect(normalizeIdentifier("77 123 45 67")).toBe("+221771234567");
  });
});

describe("passwords, codes, names", () => {
  it("applies the donor (8) and organisation (12) minimums", () => {
    expect(isValidPassword("1234567", "donor")).toBe(false);
    expect(isValidPassword("12345678", "donor")).toBe(true);
    expect(isValidPassword("12345678901", "organization")).toBe(false);
    expect(isValidPassword("123456789012", "organization")).toBe(true);
    expect(isValidPassword("x".repeat(129), "donor")).toBe(false);
  });

  it("checks 6-digit codes", () => {
    expect(isOtpFormat("012345")).toBe(true);
    expect(isOtpFormat("12345")).toBe(false);
    expect(isOtpFormat("12345a")).toBe(false);
  });

  it("normalises names", () => {
    expect(normalizeName("  Aminata   Diop ")).toBe("Aminata Diop");
    expect(normalizeName("A")).toBeNull();
  });
});
