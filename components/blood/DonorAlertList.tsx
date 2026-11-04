"use client";

import { useState } from "react";

import { useBloodAlerts } from "@/hooks/useBloodAlerts";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

import { AlertCard } from "./AlertCard";

/** "Alertes des hôpitaux" with the "Pour mon groupe" / "Toutes" filter. */
export function DonorAlertList() {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const data = useBloodAlerts(scope);
  const group = data?.bloodType ? fr.bloodTypes[data.bloodType] : null;
  const tabs = [
    {
      key: "mine" as const,
      label: group ? fr.blood.donor.filterMine(group) : fr.blood.donor.filterMineNoGroup,
    },
    { key: "all" as const, label: fr.blood.donor.filterAll },
  ];

  return (
    <section aria-labelledby="blood-alerts" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="blood-alerts" className="font-heading text-xl font-bold text-brand-blue">
          {fr.blood.donor.alertsTitle}
        </h2>
        <div role="tablist" className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={scope === tab.key}
              onClick={() => setScope(tab.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                scope === tab.key
                  ? "bg-brand-blue text-white"
                  : "bg-primary-soft text-brand-blue hover:bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {data === undefined ? (
        <p className="text-sm text-muted-foreground">{fr.blood.donor.loading}</p>
      ) : data.alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {scope === "mine" ? fr.blood.donor.emptyMine : fr.blood.donor.emptyAll}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.alerts.map((alert) => (
            <AlertCard key={alert._id} alert={alert} myType={data.bloodType} />
          ))}
        </ul>
      )}
    </section>
  );
}
