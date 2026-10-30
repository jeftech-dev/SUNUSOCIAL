"use client";

import { useId, useState } from "react";

import { communesOf, REGIONS, type Region } from "@/lib/geo";
import { fr } from "@/lib/strings.fr";

const selectClass =
  "h-12 w-full rounded-lg border-[1.5px] border-input bg-card px-3 text-[15px] text-foreground";

export interface RegionCommuneValue {
  region: Region;
  commune: string;
}

/** Region → commune pickers backed by lib/geo.ts. Changing the region resets the commune. */
export function RegionCommuneSelect({
  defaultRegion = REGIONS[0],
  onChange,
}: {
  defaultRegion?: Region;
  onChange?: (value: RegionCommuneValue) => void;
}) {
  const id = useId();
  const [region, setRegion] = useState<Region>(defaultRegion);
  const [commune, setCommune] = useState<string>(communesOf(defaultRegion)[0]);

  function update(next: RegionCommuneValue) {
    setRegion(next.region);
    setCommune(next.commune);
    onChange?.(next);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-region`} className="flex flex-col gap-1.5 text-sm font-semibold">
        {fr.foundations.region}
        <select
          id={`${id}-region`}
          className={selectClass}
          value={region}
          onChange={(e) => {
            const nextRegion = e.target.value as Region;
            update({ region: nextRegion, commune: communesOf(nextRegion)[0] });
          }}
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-commune`} className="flex flex-col gap-1.5 text-sm font-semibold">
        {fr.foundations.commune}
        <select
          id={`${id}-commune`}
          className={selectClass}
          value={commune}
          onChange={(e) => update({ region, commune: e.target.value })}
        >
          {communesOf(region).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
