"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/dates";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

type Notice = { kind: "success" | "error"; text: string };

/** Structures suspended for a late proof, with "Relancer" and "Lever la suspension" (S26). */
export function SuspendedStructures() {
  const suspended = useQuery(api.suspensions.list);
  const remind = useMutation(api.suspensions.remind);
  const lift = useMutation(api.suspensions.lift);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const run = async (action: Promise<unknown>, done: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await action;
      setNotice({ kind: "success", text: done });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!notice && (suspended === undefined || suspended.length === 0)) return null;
  const t = fr.moderation.suspended;
  return (
    <section
      aria-labelledby="suspended-structures"
      className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="suspended-structures" className="font-heading text-lg font-bold text-brand-blue">
          {t.title}
        </h2>
        <p className="text-sm text-muted-foreground">{t.intro}</p>
      </div>
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg p-3 text-sm font-semibold",
            notice.kind === "success"
              ? "bg-success-soft text-brand-green-strong"
              : "bg-[var(--danger-soft)] text-destructive",
          )}
        >
          {notice.text}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {(suspended ?? []).map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-[var(--line-warm)] p-3"
          >
            <div className="flex min-w-0 flex-col">
              <strong className="font-heading">{s.organization}</strong>
              <span className="text-sm font-semibold text-destructive">
                {t.since(formatDate(s.suspendedAt))}
              </span>
            </div>
            {s.lateProofs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noLateProof}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {s.lateProofs.map((p) => (
                  <li key={`${p.cause}-${p.dueAt}`}>
                    {t.lateProof(p.cause, formatDate(p.dueAt))} ·{" "}
                    {p.proofStatus ? t.proofStatus[p.proofStatus] : t.noProof}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || s.lateProofs.length === 0}
                onClick={() => run(remind({ structureId: s.id }), t.reminded)}
              >
                {t.remind}
              </Button>
              <Button
                variant="cta"
                size="sm"
                disabled={busy || s.lateProofs.length > 0}
                onClick={() => run(lift({ structureId: s.id }), t.lifted)}
              >
                {t.lift}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
