"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

/** The donor's blood alerts (`undefined` while loading). `mine` = compatible with their profile. */
export function useBloodAlerts(scope: "mine" | "all") {
  return useQuery(api.blood.alertsForDonor, { scope });
}
