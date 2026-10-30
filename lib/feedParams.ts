// The feed filters as URL search params, so a filtered feed can be shared and survives a reload.

import { CATEGORIES, CAUSE_FILTERS, type Category, type CauseFilter } from "./types";

export interface FeedParams {
  category?: Category;
  filter?: CauseFilter;
  query: string;
}

export function parseFeedParams(params: {
  categorie?: string;
  filtre?: string;
  q?: string;
}): FeedParams {
  const category = CATEGORIES.find((c) => c === params.categorie);
  const filter = CAUSE_FILTERS.find((f) => f === params.filtre);
  return { category, filter, query: (params.q ?? "").slice(0, 100) };
}

export function feedSearch({ category, filter, query }: FeedParams): string {
  const params = new URLSearchParams();
  if (category) params.set("categorie", category);
  if (filter) params.set("filtre", filter);
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString();
  return search ? `?${search}` : "";
}
