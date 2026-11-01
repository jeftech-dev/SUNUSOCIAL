"use client";

import { useQuery } from "convex/react";

import { CauseWizard } from "@/components/structure/CauseWizard";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fr } from "@/lib/strings.fr";

/** Loads one of the structure's own causes and prefills the edit wizard (G6 "Modifier et renvoyer"). */
export function EditCause({ id }: { id: string }) {
  const cause = useQuery(api.causes.getOwned, { causeId: id as Id<"causes"> });
  if (cause === undefined) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>;
  }
  if (cause === null) {
    return <p className="text-sm text-muted-foreground">{fr.causeDetail.notFound}</p>;
  }
  return <CauseWizard cause={cause} />;
}
