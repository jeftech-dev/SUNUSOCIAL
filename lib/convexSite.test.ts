import { describe, expect, it } from "vitest";

import { convexSiteUrl } from "./convexSite";

describe("convexSiteUrl", () => {
  it("prefers the explicit site URL, otherwise derives it from the cloud URL", () => {
    expect(convexSiteUrl("http://127.0.0.1:3211/", "http://127.0.0.1:3210")).toBe(
      "http://127.0.0.1:3211",
    );
    expect(convexSiteUrl(undefined, "https://happy-otter-123.convex.cloud")).toBe(
      "https://happy-otter-123.convex.site",
    );
    expect(convexSiteUrl(undefined, "http://127.0.0.1:3210")).toBeNull();
    expect(convexSiteUrl(undefined, undefined)).toBeNull();
  });
});
