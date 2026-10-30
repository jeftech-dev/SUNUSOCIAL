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

  it("refuses paths the browser would turn into another origin", () => {
    expect(safeNextPath("/\t/evil.example")).toBeNull();
    expect(safeNextPath("/\n/evil.example")).toBeNull();
    expect(safeNextPath("/\r\n/evil.example")).toBeNull();
    expect(safeNextPath("/\t\\evil.example")).toBeNull();
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
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
