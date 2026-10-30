"use client";

import { useState } from "react";

import {
  RegionCommuneSelect,
  type RegionCommuneValue,
} from "@/components/common/RegionCommuneSelect";
import { REGIONS, communesOf } from "@/lib/geo";
import { fr } from "@/lib/strings.fr";

/** Sprint 1 check that the region → commune lists load. */
export function LocationDemo() {
  const [value, setValue] = useState<RegionCommuneValue>({
    region: REGIONS[0],
    commune: communesOf(REGIONS[0])[0],
  });

  return (
    <div className="flex flex-col gap-4">
      <RegionCommuneSelect onChange={setValue} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fr.foundations.selected(value.commune, value.region)}
      </p>
    </div>
  );
}
