"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { WhatsAppButton } from "@/components/common/WhatsAppButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import type { CauseDetailView, SimilarCauseView } from "@/lib/types";

import { CauseBanner } from "./CauseBanner";
import { CauseTags } from "./CauseTags";
import { DonationModal } from "./DonationModal";
import { EndCondition } from "./EndCondition";
import { ProgressBar } from "./ProgressBar";

/** 04 Détail de la cause, live: progress moves as donations are confirmed. */
export function CauseDetail({ id }: { id: string }) {
  const cause = useQuery(api.causes.get, { id });

  if (cause === undefined) return <DetailSkeleton />;
  if (cause === null) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-input bg-card px-6 py-16 text-center">
        <p className="font-heading text-lg font-bold">{fr.causeDetail.notFound}</p>
        <Link href="/causes" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {fr.causeDetail.notFoundBack}
        </Link>
      </div>
    );
  }
  return <Detail cause={cause} />;
}

function Detail({ cause }: { cause: CauseDetailView }) {
  const closed = cause.status === "closed";
  const [donating, setDonating] = useState(false);
  const paymentFailed = useSearchParams().get("paiement") === "echec";
  return (
    <article className="flex flex-col gap-6">
      <BackLink />
      {paymentFailed && (
        <p
          role="status"
          className="rounded-lg bg-accent p-3 text-sm font-semibold text-brand-orange-strong"
        >
          {fr.causeDetail.paymentFailed}
        </p>
      )}
      <div className="relative overflow-hidden rounded-xl">
        <CauseBanner
          url={cause.bannerUrl}
          sizes="(min-width: 1024px) 960px, 100vw"
          priority
          className="aspect-[16/9] sm:aspect-[21/9]"
        />
        <CauseTags category={cause.category} urgent={cause.urgency === "urgent"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {cause.organization.name} · {cause.organization.city}
            <VerifiedBadge label={fr.common.verifiedStructure} />
          </p>
          <h1 className="font-heading text-2xl leading-tight font-extrabold text-brand-blue sm:text-3xl">
            {cause.title}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-primary-soft px-3 py-1 font-semibold text-brand-blue">
              {fr.causeDetail.category(fr.categories[cause.category])}
            </span>
            <span
              className={
                cause.urgency === "urgent"
                  ? "rounded-full bg-accent px-3 py-1 font-semibold text-brand-orange-strong"
                  : "rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground"
              }
            >
              {fr.causeDetail.urgency(fr.urgency[cause.urgency])}
            </span>
          </div>
          <p className="leading-relaxed whitespace-pre-line">{cause.description}</p>
          <WhatsAppButton message={fr.whatsapp.aboutCause(cause.title)} />
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border border-[var(--line-warm)] bg-card p-5 lg:sticky lg:top-6">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{fr.causeDetail.raised}</span>
            <span className="font-heading text-3xl font-extrabold">{formatFCFA(cause.raised)}</span>
            <span className="text-sm text-muted-foreground">
              {fr.causeDetail.goalOf}{" "}
              <strong className="font-semibold text-foreground">{formatFCFA(cause.goal)}</strong>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <ProgressBar
              raised={cause.raised}
              goal={cause.goal}
              percent={cause.percent}
              label={fr.causeDetail.reached(cause.percent)}
            />
            <div className="flex justify-between gap-2 text-sm">
              <span className="font-semibold">{fr.causeDetail.reached(cause.percent)}</span>
              <span className="text-muted-foreground">
                {fr.causeDetail.donors(cause.donorCount)}
              </span>
            </div>
          </div>
          <EndCondition endCondition={cause.endCondition} goal={cause.goal} closed={closed} />
          {closed ? (
            <p className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-brand-green-strong">
              {fr.causeDetail.closed}
            </p>
          ) : (
            <Button variant="cta" size="lg" onClick={() => setDonating(true)}>
              {fr.common.donate}
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            {fr.causeDetail.estimatedNet(formatFCFA(cause.estimatedNet))}
          </p>
          <div className="flex flex-col gap-1 rounded-lg bg-primary-soft p-3 text-sm text-brand-blue">
            <span className="font-heading text-xs font-bold tracking-wide">
              {fr.causeDetail.fundsRule}
            </span>
            <span>{fr.causeDetail.fundsNote}</span>
          </div>
        </aside>
      </div>

      {cause.similar.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="similar-title">
          <h2 id="similar-title" className="font-heading text-2xl font-extrabold">
            {fr.causeDetail.similar}
          </h2>
          <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {cause.similar.map((similar) => (
              <li key={similar.id} className="w-64 shrink-0 snap-start sm:w-auto">
                <SimilarCard cause={similar} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {donating && (
        <DonationModal
          cause={{ id: cause.id, title: cause.title, organization: cause.organization.name }}
          onClose={() => setDonating(false)}
        />
      )}
    </article>
  );
}

function SimilarCard({ cause }: { cause: SimilarCauseView }) {
  return (
    <Link
      href={`/causes/${cause.id}`}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--line-warm)] bg-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <CauseBanner url={cause.bannerUrl} sizes="256px" className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="font-heading text-[15px] leading-snug font-bold">{cause.title}</h3>
        <ProgressBar
          raised={cause.raised}
          goal={cause.goal}
          percent={cause.percent}
          label={fr.causeDetail.reached(cause.percent)}
          className="mt-auto"
        />
        <span className="text-xs text-muted-foreground">
          {formatFCFA(cause.raised)} / {formatFCFA(cause.goal)}
        </span>
      </div>
    </Link>
  );
}

function BackLink() {
  return (
    <Link
      href="/causes"
      className="self-start text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {fr.causeDetail.back}
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label={fr.common.loading} aria-busy="true">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="aspect-[16/9] animate-pulse rounded-xl bg-muted sm:aspect-[21/9]" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
