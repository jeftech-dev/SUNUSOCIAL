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
  // Only causes still in moderation or refused can be edited (mirrors `causes.update`); for any other
  // status, say so up front rather than render an editable wizard whose submit the server will reject.
  if (cause.status !== "pending_review" && cause.status !== "refused") {
    return <p className="text-sm text-muted-foreground">{fr.errors.causeNotEditable}</p>;
  }
  return <CauseWizard cause={cause} />;
}
