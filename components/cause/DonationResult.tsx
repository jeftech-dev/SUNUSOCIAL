"use client";

import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import type { DonationStatusView } from "@/lib/types";

import { ProgressBar } from "./ProgressBar";

/** 05b Retour de paiement (NabooPay success_url): confirms the donation and shows its status live. */
export function DonationResult({ id }: { id: string }) {
  const donation = useQuery(api.donations.status, { donationId: id });
  const refresh = useAction(api.donations.refreshStatus);
  const checked = useRef(false);

  // Once on arrival, pull the status straight from NabooPay in case the webhook was missed (DT-3).
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    refresh({ donationId: id }).catch(() => {});
  }, [id, refresh]);

  if (donation === undefined) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>;
  }
  if (donation === null) {
    return (
      <Shell title={fr.donationResult.notFound}>
        <Link href="/causes" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {fr.donationResult.browse}
        </Link>
      </Shell>
    );
  }
  if (donation.lateRefund) return <LateRefund donation={donation} />;
  if (donation.status === "held" || donation.status === "released") {
    return <Confirmed donation={donation} />;
  }
  if (donation.status === "failed") {
    return (
      <Shell title={fr.donationResult.failedTitle} tone="warn">
        <p className="text-sm text-muted-foreground">{fr.donationResult.failedBody}</p>
        <div className="flex flex-wrap gap-2">
          {donation.cause && (
            <Link
              href={`/causes/${donation.cause.id}`}
              className={buttonVariants({ variant: "cta", size: "sm" })}
            >
              {fr.donationResult.backToCause}
            </Link>
          )}
        </div>
      </Shell>
    );
  }
  // pending / refunded: still being confirmed.
  return (
    <Shell title={fr.donationResult.pendingTitle}>
      <p className="text-sm text-muted-foreground">{fr.donationResult.pendingBody}</p>
      <Link href="/profil" className={buttonVariants({ variant: "outline", size: "sm" })}>
        {fr.donationResult.history}
      </Link>
    </Shell>
  );
}

function Confirmed({ donation }: { donation: DonationStatusView }) {
  return (
    <Shell title={fr.donationResult.heldTitle} tone="success">
      {donation.cause && (
        <p className="text-sm text-muted-foreground">
          {fr.donationResult.heldBody(
            formatFCFA(donation.amount),
            fr.methods[donation.paidMethod ?? donation.method],
            donation.cause.title,
          )}
        </p>
      )}
      {donation.cause && (
        <div className="flex flex-col gap-2 rounded-lg bg-primary-soft p-4">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{fr.donationResult.newProgress}</span>
            <span className="text-muted-foreground">
              {fr.donationResult.progressOf(
                formatFCFA(donation.cause.raised),
                formatFCFA(donation.cause.goal),
              )}
            </span>
          </div>
          <ProgressBar
            raised={donation.cause.raised}
            goal={donation.cause.goal}
            percent={donation.cause.percent}
            label={fr.causeDetail.reached(donation.cause.percent)}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/profil" className={buttonVariants({ variant: "cta", size: "sm" })}>
          {fr.donationResult.history}
        </Link>
        <Link href="/causes" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {fr.donationResult.browse}
        </Link>
      </div>
    </Shell>
  );
}

function LateRefund({ donation }: { donation: DonationStatusView }) {
  return (
    <Shell title={fr.donationResult.lateTitle} tone="warn">
      <p className="text-sm text-muted-foreground">
        {fr.donationResult.lateBody(formatFCFA(donation.net))}
      </p>
      <Link href="/causes" className={buttonVariants({ variant: "cta", size: "sm" })}>
        {fr.donationResult.browse}
      </Link>
    </Shell>
  );
}

function Shell({
  title,
  tone = "neutral",
  children,
}: {
  title: string;
  tone?: "neutral" | "success" | "warn";
  children: React.ReactNode;
}) {
  const ring =
    tone === "success"
      ? "border-brand-green"
      : tone === "warn"
        ? "border-brand-orange"
        : "border-[var(--line-warm)]";
  return (
    <section
      className={`mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border ${ring} bg-card p-6 text-center`}
    >
      <h1 className="font-heading text-xl font-extrabold text-brand-blue">{title}</h1>
      {children}
    </section>
  );
}
