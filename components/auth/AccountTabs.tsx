"use client";

import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

export type AccountKind = "donor" | "organization";

const TABS: Array<{ value: AccountKind; label: string }> = [
  { value: "donor", label: fr.auth.tabDonor },
  { value: "organization", label: fr.auth.tabOrganization },
];

/** Donor / organisation switch on the auth screens (a radio group, keyboard-friendly). */
export function AccountTabs({
  value,
  onChange,
}: {
  value: AccountKind;
  onChange: (value: AccountKind) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="radio"
          aria-checked={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-full px-3 py-2.5 text-sm font-semibold transition-colors",
            value === tab.value
              ? "bg-card text-brand-blue shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
