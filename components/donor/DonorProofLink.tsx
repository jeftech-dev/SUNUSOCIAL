"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import { ProofDossier } from "@/components/proof/ProofDossier";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fr } from "@/lib/strings.fr";

/** "Voir la preuve": a donor opens the validated dossier of a cause they gave to (PARCOURS S19). */
export function DonorProofLink({ proofId }: { proofId: Id<"proofs"> }) {
  const [open, setOpen] = useState(false);
  const dossier = useQuery(api.proofs.get, open ? { proofId } : "skip");
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? fr.moderation.hideProof : fr.proof.viewProof}
      </Button>
      {open &&
        (dossier === undefined ? (
          <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
        ) : dossier ? (
          <ProofDossier dossier={dossier} />
        ) : null)}
    </div>
  );
}
