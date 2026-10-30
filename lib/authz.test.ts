import { describe, expect, it } from "vitest";

import { isModerationHost, safeNextPath } from "./authz";

describe("safeNextPath", () => {
  it("keeps same-site paths only", () => {
    expect(safeNextPath("/causes?x=1")).toBe("/causes?x=1");
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("isModerationHost", () => {
  it("recognises the moderation subdomain", () => {
    expect(isModerationHost("moderation.localhost:3000")).toBe(true);
    expect(isModerationHost("moderation.sunusocial.sn")).toBe(true);
    expect(isModerationHost("sunusocial.sn")).toBe(false);
    expect(isModerationHost(null)).toBe(false);
  });
});
