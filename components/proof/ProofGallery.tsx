import Image from "next/image";

import { fr } from "@/lib/strings.fr";
import type { ProofItemView } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The dossier items as a gallery. Photos show a thumbnail; other kinds link to the file. */
export function ProofGallery({ items }: { items: ProofItemView[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex flex-col gap-1.5 rounded-xl border bg-card p-2",
            item.flagged ? "border-destructive" : "border-[var(--line-warm)]",
          )}
        >
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            {item.kind === "photo" && item.url ? (
              <Image src={item.url} alt={item.caption ?? ""} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-2 text-center text-sm font-semibold text-muted-foreground">
                {fr.proof.itemKind[item.kind]}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold">{fr.proof.itemKind[item.kind]}</span>
            {item.flagged && (
              <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 font-semibold text-destructive">
                {fr.proof.flagBadge}
              </span>
            )}
          </div>
          {item.caption && <p className="text-xs text-muted-foreground">{item.caption}</p>}
          {(item.supplier || item.ref) && (
            <p className="text-xs text-muted-foreground">
              {[item.supplier, item.ref].filter(Boolean).join(" · ")}
            </p>
          )}
          {item.flagged && item.flagReason && (
            <p className="text-xs font-medium text-destructive">{item.flagReason}</p>
          )}
          {item.kind !== "photo" && item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-brand-blue underline"
            >
              {fr.common.seeMore}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
