"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useMe } from "@/hooks/useMe";
import { fr } from "@/lib/strings.fr";

/** Count of compatible alerts the donor has not answered yet, shown next to the "Don de sang" link. */
export function BloodNavBadge() {
  const me = useMe();
  // The nav renders outside RequireRole: only ask once we know the caller is a donor.
  const data = useQuery(
    api.blood.alertsForDonor,
    me?.user.role === "donor" ? { scope: "mine" } : "skip",
  );
  const count = data?.pendingCount ?? 0;
  if (count === 0) return null;
  return (
    <span
      aria-label={fr.blood.donor.badge(count)}
      className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white"
    >
      {count}
    </span>
  );
}
