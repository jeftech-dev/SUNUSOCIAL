import { describe, expect, it } from "vitest";

import { feedSearch, parseFeedParams } from "./feedParams";

describe("feed params", () => {
  it("keeps known values and drops the rest", () => {
    expect(parseFeedParams({ categorie: "Santé", filtre: "almost", q: "lait" })).toEqual({
      category: "Santé",
      filter: "almost",
      query: "lait",
    });
    expect(parseFeedParams({ categorie: "Autre", filtre: "popular" })).toEqual({
      category: undefined,
      filter: undefined,
      query: "",
    });
  });

  it("round-trips through the URL", () => {
    const params = { category: "Matériel" as const, filter: "urgent" as const, query: "fauteuils" };
    const search = feedSearch(params);
    expect(search).toBe("?categorie=Mat%C3%A9riel&filtre=urgent&q=fauteuils");
    expect(parseFeedParams(Object.fromEntries(new URLSearchParams(search)))).toEqual(params);
    expect(feedSearch({ query: "  " })).toBe("");
  });
});
