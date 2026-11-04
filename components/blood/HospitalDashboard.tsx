"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useMe } from "@/hooks/useMe";
import { fr } from "@/lib/strings.fr";

import { HospitalAlerts } from "./HospitalAlerts";
import { StockPanel } from "./StockPanel";

/** 09 Tableau de bord hôpital: stock, alerts in progress, attendance (PARCOURS S25–S30). */
export function HospitalDashboard() {
  const me = useMe();
  const approved = me?.structure?.status === "approved" && me.structure.suspendedAt === undefined;
  // Pending, refused and suspended hospitals cannot write: show only their status.
  const overview = useQuery(api.blood.hospitalOverview, approved ? {} : "skip");

  if (!approved) return null;
  if (overview === undefined) {
    return <p className="text-sm text-muted-foreground">{fr.blood.hospital.loading}</p>;
  }
  if (overview === null) return null;
  return (
    <div className="flex flex-col gap-8">
      <StockPanel entries={overview.stock.entries} updatedAt={overview.stock.updatedAt} />
      <HospitalAlerts alerts={overview.alerts} hospitalName={me?.structure?.name ?? ""} />
    </div>
  );
}
