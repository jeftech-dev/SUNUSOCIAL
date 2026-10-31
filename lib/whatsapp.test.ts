import { describe, expect, it } from "vitest";

import { whatsappLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("builds a wa.me link with the digits and an encoded message", () => {
    expect(whatsappLink("Bonjour SUNUSOCIAL", "+221 77 123 45 67")).toBe(
      "https://wa.me/221771234567?text=Bonjour%20SUNUSOCIAL",
    );
  });

  it("returns null while no number is configured", () => {
    expect(whatsappLink("Bonjour", undefined)).toBeNull();
    expect(whatsappLink("Bonjour", "")).toBeNull();
  });
});
