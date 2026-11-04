"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { ProofReview } from "@/components/moderation/ProofReview";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiError } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import type {
  DeletionQueueItem,
  ExtensionQueueItem,
  PayoutChangeQueueItem,
  RefundQueueItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "structures" | "causes" | "proofs" | "deletions" | "refunds" | "extensions" | "payoutChanges";
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
  const decideDeletion = useMutation(api.moderation.decideDeletion);
  const decideRefund = useMutation(api.moderation.decideRefund);
  const decideExtension = useMutation(api.moderation.decideExtension);
  const decidePayoutAccount = useMutation(api.moderation.decidePayoutAccount);

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
    {
      key: "structures",
      label: fr.moderation.tabs.structures,
      count: queues?.structures.count ?? 0,
    },
    { key: "causes", label: fr.moderation.tabs.causes, count: queues?.causes.count ?? 0 },
    { key: "proofs", label: fr.moderation.tabs.proofs, count: queues?.proofs.count ?? 0 },
    {
      key: "deletions",
      label: fr.moderation.tabs.deletions,
      count: queues?.deletions.count ?? 0,
    },
    { key: "refunds", label: fr.moderation.tabs.refunds, count: queues?.refunds.count ?? 0 },
    {
      key: "extensions",
      label: fr.moderation.tabs.extensions,
      count: queues?.extensions.count ?? 0,
    },
    {
      key: "payoutChanges",
      label: fr.moderation.tabs.payoutChanges,
      count: queues?.payoutChanges.count ?? 0,
    },
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
              {reason.target.kind === "proof"
                ? fr.moderation.confirmEscalate
                : fr.moderation.confirmRefuse}
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
                    onClick={() => run(decideStructure({ structureId: s.id, decision: "approve" }))}
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
      ) : tab === "proofs" ? (
        queues.proofs.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.moderation.emptyProofs}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queues.proofs.items.map((p) => (
              <ProofReview
                key={p.id}
                item={p}
                busy={busy}
                onValidate={(proofId) => run(decideProof({ proofId, decision: "validate" }))}
                onEscalate={(proofId) =>
                  setReason({ target: { kind: "proof", id: proofId }, text: "" })
                }
              />
            ))}
          </ul>
        )
      ) : tab === "deletions" ? (
        queues.deletions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.moderation.emptyDeletions}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queues.deletions.items.map((d) => (
              <DeletionRow
                key={d.id}
                item={d}
                busy={busy}
                onDecide={(args) => run(decideDeletion(args))}
              />
            ))}
          </ul>
        )
      ) : tab === "refunds" ? (
        queues.refunds.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.moderation.emptyRefunds}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queues.refunds.items.map((r) => (
              <RefundRow
                key={r.id}
                item={r}
                busy={busy}
                onDecide={(args) => run(decideRefund(args))}
              />
            ))}
          </ul>
        )
      ) : tab === "extensions" ? (
        queues.extensions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.moderation.emptyExtensions}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queues.extensions.items.map((e) => (
              <ExtensionRow
                key={e.id}
                item={e}
                busy={busy}
                onDecide={(args) => run(decideExtension(args))}
              />
            ))}
          </ul>
        )
      ) : queues.payoutChanges.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.moderation.emptyPayoutChanges}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {queues.payoutChanges.items.map((p) => (
            <PayoutChangeRow
              key={p.id}
              item={p}
              busy={busy}
              onDecide={(args) => run(decidePayoutAccount(args))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One deletion request: a decision reason (always) plus the fund fate on approval (DT-24). */
function DeletionRow({
  item,
  busy,
  onDecide,
}: {
  item: DeletionQueueItem;
  busy: boolean;
  onDecide: (args: {
    requestId: Id<"deletionRequests">;
    decision: "approve" | "maintain";
    reason: string;
    fundOutcome?: "refund" | "payout";
  }) => void;
}) {
  const [reason, setReason] = useState("");
  const decide = (decision: "approve" | "maintain", fundOutcome?: "refund" | "payout") =>
    onDecide({ requestId: item.id, decision, reason: reason.trim(), fundOutcome });

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex min-w-0 flex-col">
        <strong className="font-heading">{item.cause}</strong>
        <span className="text-sm text-muted-foreground">
          {item.organization} · {fr.moderation.deletionRaised(formatFCFA(item.raised))}
        </span>
        <span className="mt-1 text-sm">{fr.moderation.reasonFromStructure(item.reason)}</span>
      </div>
      <label className="text-sm font-semibold" htmlFor={`reason-${item.id}`}>
        {fr.moderation.decisionReasonLabel}
      </label>
      <textarea
        id={`reason-${item.id}`}
        value={reason}
        placeholder={fr.moderation.refuseReasonPlaceholder}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-16 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px]"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => decide("maintain")}>
          {fr.moderation.confirmDeletionMaintain}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => decide("approve", "refund")}
        >
          {fr.moderation.fundOutcomeRefund}
        </Button>
        <Button variant="cta" size="sm" disabled={busy} onClick={() => decide("approve", "payout")}>
          {fr.moderation.fundOutcomePayout}
        </Button>
      </div>
    </li>
  );
}

/** One refund request: approve (net payout) or reject. The decision is final (DT-7). */
function RefundRow({
  item,
  busy,
  onDecide,
}: {
  item: RefundQueueItem;
  busy: boolean;
  onDecide: (args: { requestId: Id<"refundRequests">; decision: "refunded" | "rejected" }) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex min-w-0 flex-col">
        <strong className="font-heading">{item.cause}</strong>
        <span className="text-sm text-muted-foreground">
          {fr.moderation.refundMeta(item.donor, formatFCFA(item.amount))}
        </span>
        <span className="mt-1 text-sm">{fr.moderation.reasonFromStructure(item.reason)}</span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onDecide({ requestId: item.id, decision: "rejected" })}
        >
          {fr.moderation.confirmRefundReject}
        </Button>
        <Button
          variant="cta"
          size="sm"
          disabled={busy}
          onClick={() => onDecide({ requestId: item.id, decision: "refunded" })}
        >
          {fr.moderation.confirmRefundApprove}
        </Button>
      </div>
    </li>
  );
}

/** One extension request: approve moves the deadline; refuse needs a reason (DT-30). */
function ExtensionRow({
  item,
  busy,
  onDecide,
}: {
  item: ExtensionQueueItem;
  busy: boolean;
  onDecide: (args: {
    requestId: Id<"extensionRequests">;
    decision: "approve" | "refuse";
    reason?: string;
  }) => void;
}) {
  const [reason, setReason] = useState("");
  const kindLabel =
    item.kind === "cause_deadline"
      ? fr.moderation.extensionKindCause
      : fr.moderation.extensionKindProof;
  const current = item.currentUntil === null ? fr.moderation.extensionNoCurrent : formatDate(item.currentUntil);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex min-w-0 flex-col">
        <strong className="font-heading">{item.target}</strong>
        <span className="text-sm text-muted-foreground">
          {item.organization} · {kindLabel}
        </span>
        <span className="mt-1 text-sm">
          {fr.moderation.extensionDates(current, formatDate(item.requestedUntil))}
        </span>
        <span className="mt-1 text-sm">{fr.moderation.reasonFromStructure(item.reason)}</span>
      </div>
      <textarea
        aria-label={fr.moderation.refuseReasonLabel}
        value={reason}
        placeholder={fr.moderation.refuseReasonPlaceholder}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-14 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px]"
      />
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !reason.trim()}
          onClick={() => onDecide({ requestId: item.id, decision: "refuse", reason: reason.trim() })}
        >
          {fr.moderation.confirmExtensionRefuse}
        </Button>
        <Button
          variant="cta"
          size="sm"
          disabled={busy}
          onClick={() => onDecide({ requestId: item.id, decision: "approve" })}
        >
          {fr.moderation.confirmExtensionApprove}
        </Button>
      </div>
    </li>
  );
}

/** One payout-account change: approve switches the live account; refuse needs a reason (DT-5). */
function PayoutChangeRow({
  item,
  busy,
  onDecide,
}: {
  item: PayoutChangeQueueItem;
  busy: boolean;
  onDecide: (args: {
    structureId: Id<"structures">;
    decision: "approve" | "refuse";
    reason?: string;
  }) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex min-w-0 flex-col">
        <strong className="font-heading">{item.organization}</strong>
        <span className="text-sm text-muted-foreground">
          {fr.moderation.payoutChangeMeta(fr.methods[item.method], item.holderName)}
        </span>
        <span className="mt-1 font-mono text-sm">{item.accountNumber}</span>
      </div>
      <textarea
        aria-label={fr.moderation.refuseReasonLabel}
        value={reason}
        placeholder={fr.moderation.refuseReasonPlaceholder}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-14 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px]"
      />
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !reason.trim()}
          onClick={() => onDecide({ structureId: item.id, decision: "refuse", reason: reason.trim() })}
        >
          {fr.moderation.confirmPayoutRefuse}
        </Button>
        <Button
          variant="cta"
          size="sm"
          disabled={busy}
          onClick={() => onDecide({ structureId: item.id, decision: "approve" })}
        >
          {fr.moderation.confirmPayoutApprove}
        </Button>
      </div>
    </li>
  );
}
