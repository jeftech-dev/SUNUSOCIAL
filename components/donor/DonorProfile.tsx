"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { DonorProofLink } from "@/components/donor/DonorProofLink";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/dates";
import { toUiError } from "@/lib/errors";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import type { DonationHistoryView } from "@/lib/types";

const PAGE_SIZE = 10;

/** 06 Profil donateur (PARCOURS S19): impact summary and donation history. */
export function DonorProfile() {
  const me = useQuery(api.auth.me);
  const impact = useQuery(api.donations.impact, {});
  const {
    results: donations,
    status,
    loadMore,
  } = usePaginatedQuery(api.donations.mine, {}, { initialNumItems: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-extrabold text-brand-blue">{fr.profile.title}</h1>
        {me && <p className="text-sm text-muted-foreground">{me.user.name}</p>}
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Stat label={fr.profile.total} value={formatFCFA(impact?.total ?? 0)} />
        <Stat label={fr.profile.causes} value={String(impact?.causeCount ?? 0)} />
      </section>
      {impact && impact.donationCount > 0 && (
        <p className="rounded-lg bg-primary-soft p-3 text-sm text-brand-blue">
          {fr.profile.impact(impact.causeCount, formatFCFA(impact.total))}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">{fr.profile.history}</h2>
        {status === "LoadingFirstPage" ? (
          <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
        ) : donations.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-input bg-card p-6">
            <p className="text-sm text-muted-foreground">{fr.profile.empty}</p>
            <Link href="/causes" className={buttonVariants({ variant: "cta", size: "sm" })}>
              {fr.profile.emptyCta}
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {donations.map((donation) => (
                <DonationRow key={donation.id} donation={donation} />
              ))}
            </ul>
            {status === "CanLoadMore" && (
              <Button
                variant="outline"
                size="sm"
                className="self-center"
                onClick={() => loadMore(PAGE_SIZE)}
              >
                {fr.profile.loadMore}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function DonationRow({ donation }: { donation: DonationHistoryView }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/causes/${donation.causeId}`}
            className="font-heading font-bold text-brand-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {donation.cause}
          </Link>
          <span className="text-sm text-muted-foreground">{donation.organization}</span>
          <span className="text-xs text-muted-foreground">
            {fr.profile.dateMethod(formatDate(donation.date), fr.methods[donation.method])}
          </span>
        </div>
        <strong className="shrink-0 font-heading">{formatFCFA(donation.amount)}</strong>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge donation={donation} />
      </div>

      {donation.lateRefund && (
        <p className="rounded-lg bg-accent p-2.5 text-xs text-brand-orange-strong">
          {fr.profile.lateRefund(formatFCFA(donation.net))}
        </p>
      )}
      {!donation.lateRefund && donation.proof.available && donation.proof.proofId ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-brand-green-strong">
            {fr.profile.proofValidated(donation.proof.itemCount)}
          </p>
          <DonorProofLink proofId={donation.proof.proofId} />
        </div>
      ) : (
        !donation.lateRefund &&
        donation.status === "held" &&
        !donation.proof.available && (
          <p className="text-xs text-muted-foreground">{fr.profile.proofPending}</p>
        )
      )}

      {donation.refund.eligible && <RefundRequest donation={donation} />}
    </li>
  );
}

/** Inline refund-request form, shown while a held donation is still eligible (DT-7). */
function RefundRequest({ donation }: { donation: DonationHistoryView }) {
  const requestRefund = useMutation(api.donations.requestRefund);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {fr.profile.refundHint(formatFCFA(donation.refund.estimatedAmount))}
        </p>
        <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
          {fr.profile.requestRefund}
        </Button>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestRefund({
        donationId: donation.id,
        reason: reason.trim(),
        receivingPhone: phone.trim() || undefined,
      });
      setOpen(false);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-input bg-background p-3">
      <label className="text-xs font-semibold" htmlFor={`refund-reason-${donation.id}`}>
        {fr.profile.refundReasonLabel}
      </label>
      <textarea
        id={`refund-reason-${donation.id}`}
        value={reason}
        placeholder={fr.profile.refundReasonPlaceholder}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-16 w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
      />
      <label className="text-xs font-semibold" htmlFor={`refund-phone-${donation.id}`}>
        {fr.profile.refundPhoneLabel}
      </label>
      <input
        id={`refund-phone-${donation.id}`}
        value={phone}
        inputMode="tel"
        placeholder={fr.profile.refundPhoneHint}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
      />
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          {fr.common.cancel}
        </Button>
        <Button variant="cta" size="sm" disabled={busy || !reason.trim()} onClick={submit}>
          {fr.profile.refundSubmit}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ donation }: { donation: DonationHistoryView }) {
  const label = donation.lateRefund
    ? fr.donationStatus.refunded
    : fr.donationStatus[donation.status];
  const tone =
    donation.status === "held" || donation.status === "released"
      ? "bg-success-soft text-brand-green-strong"
      : donation.status === "failed"
        ? "bg-muted text-muted-foreground"
        : "bg-primary-soft text-brand-blue";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-xl font-extrabold text-brand-blue">{value}</span>
    </div>
  );
}
