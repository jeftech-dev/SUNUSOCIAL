"use client";

import { usePaginatedQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Category, CauseFilter } from "@/lib/types";

export const FEED_PAGE_SIZE = 12;

export interface FeedFilters {
  category?: Category;
  filter?: CauseFilter;
  query?: string;
}

/** The live causes feed: pages of `causes.list`, more on `loadMore`. */
export function useCauses(filters: FeedFilters) {
  return usePaginatedQuery(api.causes.list, filters, { initialNumItems: FEED_PAGE_SIZE });
}
