"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import { ProofDossier } from "@/components/proof/ProofDossier";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fr } from "@/lib/strings.fr";

/** One proof in the queue: toggle the exact donor-facing dossier, then validate or escalate. */
export function ProofReview({
  item,
  busy,
  onValidate,
  onEscalate,
}: {
  item: { id: Id<"proofs">; cause: string; flagged: boolean };
  busy: boolean;
  onValidate: (proofId: Id<"proofs">) => void;
  onEscalate: (proofId: Id<"proofs">) => void;
}) {
  const [open, setOpen] = useState(false);
  const dossier = useQuery(api.proofs.get, open ? { proofId: item.id } : "skip");

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <strong className="font-heading">{item.cause}</strong>
          {item.flagged && (
            <span className="text-sm font-semibold text-destructive">
              {fr.moderation.flaggedBadge}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? fr.moderation.hideProof : fr.moderation.reviewProof}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onEscalate(item.id)}>
            {fr.moderation.escalate}
          </Button>
          <Button variant="cta" size="sm" disabled={busy} onClick={() => onValidate(item.id)}>
            {fr.moderation.validate}
          </Button>
        </div>
      </div>
      {open &&
        (dossier === undefined ? (
          <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
        ) : dossier === null ? (
          <p className="text-sm text-muted-foreground">{fr.causeDetail.notFound}</p>
        ) : (
          <ProofDossier dossier={dossier} />
        ))}
    </li>
  );
}
