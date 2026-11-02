import { ProofGallery } from "@/components/proof/ProofGallery";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import type { ProofDossierView } from "@/lib/types";

/** The full reception dossier as donors and moderators see it (report, spend, gallery). */
export function ProofDossier({ dossier }: { dossier: ProofDossierView }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-heading text-xl font-extrabold text-brand-blue">{fr.proof.gallery}</h2>

      {dossier.dossierFlags.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-destructive">
          {dossier.dossierFlags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="font-heading font-bold">{fr.proof.reportHeading}</h3>
        <p className="text-sm whitespace-pre-line text-muted-foreground">{dossier.report}</p>
      </div>

      {dossier.spend.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading font-bold">{fr.proof.spendHeading}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {dossier.spend.map((line, i) => (
              <li key={`${line.label}-${i}`} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{line.label}</span>
                <span className="font-semibold">{formatFCFA(line.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProofGallery items={dossier.items} />
    </section>
  );
}
