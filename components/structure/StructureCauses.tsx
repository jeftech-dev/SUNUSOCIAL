"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { CauseStatusTimeline } from "@/components/structure/CauseStatusTimeline";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMe } from "@/hooks/useMe";
import { formatDate } from "@/lib/dates";
import { toUiError } from "@/lib/errors";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

type Notice = { kind: "success" | "error"; text: string };

/** The structure's own causes with their moderation status and actions (PARCOURS S12–S14). */
export function StructureCauses() {
  const me = useMe();
  const causes = useQuery(api.causes.mine);
  const withdraw = useMutation(api.causes.withdraw);
  const requestDeletion = useMutation(api.causes.requestDeletion);
  const requestExtension = useMutation(api.extensions.request);
  const [pending, setPending] = useState<Id<"causes"> | null>(null);
  const [extendId, setExtendId] = useState<Id<"causes"> | null>(null);
  const [delayId, setDelayId] = useState<Id<"causes"> | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // A suspended structure cannot publish (DB-17): the server refuses, so the entry points go too.
  const approved = me?.structure?.status === "approved" && me.structure.suspendedAt === undefined;

  const onWithdraw = async (causeId: Id<"causes">) => {
    if (!window.confirm(fr.structureCauses.withdrawConfirm)) return;
    setPending(causeId);
    setNotice(null);
    try {
      await withdraw({ causeId });
      setNotice({ kind: "success", text: fr.structureCauses.withdrawn });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setPending(null);
    }
  };

  const onRequestDeletion = async (causeId: Id<"causes">) => {
    const reason = window.prompt(fr.structureCauses.deletionPrompt);
    if (reason === null) return;
    setPending(causeId);
    setNotice(null);
    try {
      await requestDeletion({ causeId, reason });
      setNotice({ kind: "success", text: fr.structureCauses.deletionRequested });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-extrabold text-brand-blue">
          {fr.structureCauses.heading}
        </h2>
        {approved && (
          <Button variant="cta" asChild>
            <Link href="/structure/causes/nouvelle">{fr.structureCauses.new}</Link>
          </Button>
        )}
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

      {causes === undefined ? (
        <p className="text-sm text-muted-foreground">{fr.structureCauses.loading}</p>
      ) : causes.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[var(--line-warm)] bg-card p-6">
          <p className="text-muted-foreground">{fr.structureCauses.empty}</p>
          {approved && (
            <Button variant="cta" asChild>
              <Link href="/structure/causes/nouvelle">{fr.structureCauses.emptyApprovedCta}</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {causes.map((cause) => {
            const editable = cause.status === "pending_review" || cause.status === "refused";
            const withdrawable = cause.withdrawable;
            const proof = cause.proof;
            // A dossier can be sent once funds are out, and only once (proofs.submit).
            const proofOpen = (cause.fundsReleased || proof !== null) && !proof?.status;
            return (
              <li
                key={cause.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4 sm:flex-row sm:items-start"
              >
                {cause.bannerUrl && (
                  <Image
                    src={cause.bannerUrl}
                    alt=""
                    width={120}
                    height={80}
                    className="h-20 w-full rounded-lg object-cover sm:w-32"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <strong className="font-heading text-lg">{cause.title}</strong>
                  <CauseStatusTimeline status={cause.status} />
                  {cause.refusalReason && (
                    <p className="text-sm text-destructive">
                      {fr.structureCauses.refusalReason(cause.refusalReason)}
                    </p>
                  )}
                  {cause.status === "deleted" && (
                    <p className="text-sm text-destructive">
                      {cause.deletionReason
                        ? fr.structureCauses.deletionReason(cause.deletionReason)
                        : fr.structureCauses.deleted}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {fr.structureCauses.raisedOf(formatFCFA(cause.raised), formatFCFA(cause.goal))}{" "}
                    · {fr.structureCauses.donors(cause.donorCount)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {editable && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/structure/causes/${cause.id}/modifier`}>
                          {cause.status === "refused"
                            ? fr.structureCauses.editResend
                            : fr.structureCauses.edit}
                        </Link>
                      </Button>
                    )}
                    {withdrawable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending === cause.id}
                        onClick={() => onWithdraw(cause.id)}
                      >
                        {fr.structureCauses.withdraw}
                      </Button>
                    )}
                    {cause.status === "active" && !withdrawable && !cause.fundsReleased && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending === cause.id}
                        onClick={() => onRequestDeletion(cause.id)}
                      >
                        {fr.structureCauses.requestDeletion}
                      </Button>
                    )}
                    {cause.status === "active" && !cause.fundsReleased && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExtendId((id) => (id === cause.id ? null : cause.id))}
                      >
                        {fr.structureCauses.requestExtension}
                      </Button>
                    )}
                    {proofOpen && (
                      <Button variant="cta" size="sm" asChild>
                        <Link href={`/structure/preuve/${cause.id}`}>
                          {fr.structureCauses.submitProof}
                        </Link>
                      </Button>
                    )}
                    {proofOpen && proof && !proof.delayPending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDelayId((id) => (id === cause.id ? null : cause.id))}
                      >
                        {fr.structureCauses.requestProofDelay}
                      </Button>
                    )}
                  </div>
                  {proof && (
                    <p className="text-sm font-semibold text-brand-blue">
                      {proof.status === "validated"
                        ? fr.structureCauses.proofValidated
                        : proof.status === "submitted"
                          ? fr.structureCauses.proofSubmitted
                          : proof.status === "escalated"
                            ? fr.structureCauses.proofEscalated
                            : fr.structureCauses.proofDue(formatDate(proof.dueAt))}
                      {proofOpen &&
                        proof.delayPending &&
                        ` ${fr.structureCauses.proofDelayPending}`}
                    </p>
                  )}
                  {delayId === cause.id && proof && (
                    <ExtensionForm
                      idPrefix="delay"
                      dateLabel={fr.structureCauses.proofDelayDateLabel}
                      reasonLabel={fr.structureCauses.proofDelayReasonLabel}
                      busy={pending === cause.id}
                      onSubmit={async (requestedUntil, reason) => {
                        setPending(cause.id);
                        setNotice(null);
                        try {
                          await requestExtension({
                            kind: "proof_deadline",
                            targetId: proof.deadlineId,
                            requestedUntil,
                            reason,
                          });
                          setNotice({
                            kind: "success",
                            text: fr.structureCauses.proofDelayRequested,
                          });
                          setDelayId(null);
                        } catch (error) {
                          setNotice({ kind: "error", text: toUiError(error).message });
                        } finally {
                          setPending(null);
                        }
                      }}
                    />
                  )}
                  {extendId === cause.id && (
                    <ExtensionForm
                      idPrefix="ext"
                      dateLabel={fr.structureCauses.extensionDateLabel}
                      reasonLabel={fr.structureCauses.extensionReasonLabel}
                      busy={pending === cause.id}
                      onSubmit={async (requestedUntil, reason) => {
                        setPending(cause.id);
                        setNotice(null);
                        try {
                          await requestExtension({
                            kind: "cause_deadline",
                            targetId: cause.id,
                            requestedUntil,
                            reason,
                          });
                          setNotice({
                            kind: "success",
                            text: fr.structureCauses.extensionRequested,
                          });
                          setExtendId(null);
                        } catch (error) {
                          setNotice({ kind: "error", text: toUiError(error).message });
                        } finally {
                          setPending(null);
                        }
                      }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Inline form to request a new cause deadline or a proof delay (DT-30). The server enforces the
 * max extension.
 */
function ExtensionForm({
  idPrefix,
  dateLabel,
  reasonLabel,
  busy,
  onSubmit,
}: {
  idPrefix: string;
  dateLabel: string;
  reasonLabel: string;
  busy: boolean;
  onSubmit: (requestedUntil: number, reason: string) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const submit = () => {
    const ts = new Date(date).getTime();
    if (Number.isNaN(ts)) return;
    onSubmit(ts, reason.trim());
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-input bg-background p-3">
      <label className="text-xs font-semibold" htmlFor={`${idPrefix}-date`}>
        {dateLabel}
      </label>
      <input
        id={`${idPrefix}-date`}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
      />
      <label className="text-xs font-semibold" htmlFor={`${idPrefix}-reason`}>
        {reasonLabel}
      </label>
      <textarea
        id={`${idPrefix}-reason`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-16 w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
      />
      <Button
        variant="cta"
        size="sm"
        className="self-start"
        disabled={busy || !date || !reason.trim()}
        onClick={submit}
      >
        {fr.structureCauses.extensionSubmit}
      </Button>
    </div>
  );
}
