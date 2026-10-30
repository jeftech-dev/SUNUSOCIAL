import { describe, expect, it } from "vitest";

import { communesOf, GEO, isValidCommune, isValidRegion, REGIONS } from "./geo";

describe("geo", () => {
  it("lists the 8 interim regions, each with communes", () => {
    expect(REGIONS).toHaveLength(8);
    expect(REGIONS[0]).toBe("Dakar");
    for (const region of REGIONS) expect(GEO[region].length).toBeGreaterThan(0);
  });

  it("has no duplicate commune within a region", () => {
    for (const region of REGIONS) {
      expect(new Set(GEO[region]).size).toBe(GEO[region].length);
    }
  });

  it("validates regions", () => {
    expect(isValidRegion("Thiès")).toBe(true);
    expect(isValidRegion("Thies")).toBe(false);
    expect(isValidRegion("toString")).toBe(false);
  });

  it("returns the communes of a region", () => {
    expect(communesOf("Kaolack")).toEqual(["Kaolack", "Nioro du Rip", "Guinguinéo"]);
    expect(communesOf("Atlantis")).toEqual([]);
  });

  it("validates a commune against its region", () => {
    expect(isValidCommune("Dakar", "Médina")).toBe(true);
    expect(isValidCommune("Thiès", "Médina")).toBe(false);
    expect(isValidCommune("Atlantis", "Médina")).toBe(false);
  });
});
