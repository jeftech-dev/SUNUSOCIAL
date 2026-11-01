"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { ProofReview } from "@/components/moderation/ProofReview";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

type Tab = "structures" | "causes" | "proofs";
type Notice = { kind: "success" | "error"; text: string };
type ReasonTarget =
  | { kind: "structure"; id: Id<"structures"> }
  | { kind: "cause"; id: Id<"causes"> }
  | { kind: "proof"; id: Id<"proofs"> };

/** Mod 02: the structures / causes / proofs queues with approve / refuse / validate actions. */
export function ModerationQueues() {
  const queues = useQuery(api.moderation.queues);
  const decideStructure = useMutation(api.moderation.decideStructure);
  const decideCause = useMutation(api.moderation.decideCause);
  const decideProof = useMutation(api.moderation.decideProof);

  const [tab, setTab] = useState<Tab>("structures");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<{ target: ReasonTarget; text: string } | null>(null);

  const run = async (action: Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action;
      setNotice({ kind: "success", text: fr.moderation.done });
      setReason(null);
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setBusy(false);
    }
  };

  const confirmReason = () => {
    if (!reason) return;
    const text = reason.text.trim();
    const { target } = reason;
    if (target.kind === "structure") {
      run(decideStructure({ structureId: target.id, decision: "refuse", reason: text }));
    } else if (target.kind === "cause") {
      run(decideCause({ causeId: target.id, decision: "refuse", reason: text }));
    } else {
      run(decideProof({ proofId: target.id, decision: "escalate", reason: text }));
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "structures", label: fr.moderation.tabs.structures, count: queues?.structures.count ?? 0 },
    { key: "causes", label: fr.moderation.tabs.causes, count: queues?.causes.count ?? 0 },
    { key: "proofs", label: fr.moderation.tabs.proofs, count: queues?.proofs.count ?? 0 },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-extrabold text-brand-blue">
          {fr.moderation.queuesTitle}
        </h1>
        <Link
          href="/coup-de-coeur"
          className="text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
        >
          {fr.moderation.featuredLink}
        </Link>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              tab === t.key
                ? "bg-brand-blue text-white"
                : "bg-primary-soft text-brand-blue hover:bg-accent",
            )}
          >
            {fr.moderation.tabCount(t.label, t.count)}
          </button>
        ))}
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

      {reason && (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive bg-card p-4">
          <label className="text-sm font-semibold" htmlFor="reason">
            {reason.target.kind === "proof"
              ? fr.moderation.escalateReasonLabel
              : fr.moderation.refuseReasonLabel}
          </label>
          <textarea
            id="reason"
            value={reason.text}
            autoFocus
            placeholder={fr.moderation.refuseReasonPlaceholder}
            onChange={(e) => setReason((r) => (r ? { ...r, text: e.target.value } : r))}
            className="min-h-20 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px]"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReason(null)}>
              {fr.moderation.cancel}
            </Button>
            <Button variant="cta" size="sm" disabled={busy} onClick={confirmReason}>
              {fr.moderation.confirmRefuse}
            </Button>
          </div>
        </div>
      )}

      {queues === undefined ? (
        <p className="text-sm text-muted-foreground">{fr.moderation.loading}</p>
      ) : tab === "structures" ? (
        queues.structures.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.moderation.emptyStructures}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queues.structures.items.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4"
              >
                <div className="flex min-w-0 flex-col">
                  <strong className="font-heading">{s.name}</strong>
                  <span className="text-sm text-muted-foreground">
                    {fr.moderation.structureMeta(s.type, s.region)}
                    {s.hasPayout ? ` · ${fr.moderation.hasPayout}` : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setReason({ target: { kind: "structure", id: s.id }, text: "" })}
                  >
                    {fr.moderation.refuse}
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(decideStructure({ structureId: s.id, decision: "approve" }))
                    }
                  >
                    {fr.moderation.approve}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : tab === "causes" ? (
        queues.causes.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.moderation.emptyCauses}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queues.causes.items.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4"
              >
                <div className="flex min-w-0 flex-col">
                  <strong className="font-heading">{c.title}</strong>
                  <span className="text-sm text-muted-foreground">
                    {c.organization}
                    {c.urgent ? ` · ${fr.common.urgent}` : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setReason({ target: { kind: "cause", id: c.id }, text: "" })}
                  >
                    {fr.moderation.refuse}
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(decideCause({ causeId: c.id, decision: "approve" }))}
                  >
                    {fr.moderation.approve}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : queues.proofs.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.moderation.emptyProofs}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {queues.proofs.items.map((p) => (
            <ProofReview
              key={p.id}
              item={p}
              busy={busy}
              onValidate={(proofId) => run(decideProof({ proofId, decision: "validate" }))}
              onEscalate={(proofId) => setReason({ target: { kind: "proof", id: proofId }, text: "" })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
