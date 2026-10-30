"use client";

import { useMe } from "@/hooks/useMe";
import { fr } from "@/lib/strings.fr";

/** Greeting + validation state of the signed-in structure or hospital. */
export function StructureStatus({ title }: { title: string }) {
  const me = useMe();
  if (!me) return null;
  const structure = me.structure;
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-green-strong">
        {title}
      </p>
      <h1 className="text-3xl font-extrabold text-brand-blue">{structure?.name ?? me.user.name}</h1>
      <p className="text-muted-foreground">{fr.spaces.hello(me.user.name)}</p>
      {structure?.status === "pending" && (
        <p role="status" className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
          {fr.spaces.pending}
        </p>
      )}
      {structure?.status === "refused" && (
        <p
          role="status"
          className="rounded-lg bg-[var(--danger-soft)] px-4 py-3 text-sm text-destructive"
        >
          {fr.spaces.refused(structure.refusalReason ?? "")}
        </p>
      )}
      {structure?.status === "approved" && (
        <p
          role="status"
          className="rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-success"
        >
          {fr.spaces.approved}
        </p>
      )}
    </section>
  );
}
