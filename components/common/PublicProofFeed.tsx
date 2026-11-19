"use client";

import { useQuery } from "convex/react";
import Image from "next/image";

import { api } from "@/convex/_generated/api";
import { fr } from "@/lib/strings.fr";

/** The public "Preuves de réception" showcase of validated dossiers (PARCOURS S19, no account). */
export function PublicProofFeed() {
  const proofs = useQuery(api.proofs.publicFeed, {});
  if (!proofs || proofs.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-extrabold text-brand-blue">{fr.landing.proofs}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proofs.map((proof) => (
          <li
            key={proof.proofId}
            className="flex flex-col gap-2 overflow-hidden rounded-xl border border-[var(--line-warm)] bg-card"
          >
            <div className="relative aspect-video bg-muted">
              {proof.coverUrl && (
                <Image src={proof.coverUrl} alt="" fill className="object-cover" />
              )}
            </div>
            <div className="flex flex-col gap-1 p-3">
              <strong className="font-heading">{proof.causeTitle}</strong>
              <span className="text-sm text-muted-foreground">{proof.organization}</span>
              <span className="text-xs font-semibold text-brand-green-strong">
                {fr.profile.proofValidated(proof.itemCount)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
