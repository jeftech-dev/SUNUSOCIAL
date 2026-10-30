"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

/** The signed-in account (`undefined` while loading, `null` when signed out). */
export function useMe() {
  return useQuery(api.auth.me);
}
