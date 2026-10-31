"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

type Notice = { kind: "success" | "error"; text: string };

/** S15: pick, replace or remove the Coup de cœur de la semaine (DB-6). */
export function FeaturedPicker() {
  const candidates = useQuery(api.moderation.featuredCandidates);
  const setFeatured = useMutation(api.moderation.setFeatured);
  const [pending, setPending] = useState<Id<"causes"> | "clear" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const choose = async (causeId: Id<"causes"> | null) => {
    setPending(causeId ?? "clear");
    setNotice(null);
    try {
      const { message } = await setFeatured({ causeId });
      setNotice({ kind: "success", text: message });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setPending(null);
    }
  };

  const current = candidates?.find((c) => c.featured);

  return (
    <section className="flex flex-col gap-6">
      <Link
        href="/file"
        className="self-start text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        {fr.featuredPicker.backToQueues}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-extrabold text-brand-blue">
          {fr.featuredPicker.title}
        </h1>
        <p className="text-muted-foreground">{fr.featuredPicker.intro}</p>
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

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-5">
        <h2 className="font-heading text-sm font-bold tracking-wide text-muted-foreground uppercase">
          {fr.featuredPicker.current}
        </h2>
        {candidates === undefined ? (
          <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
        ) : current ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <strong className="font-heading text-lg">♥ {current.title}</strong>
              <span className="text-sm text-muted-foreground">{current.organization}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => choose(null)}
            >
              {fr.featuredPicker.remove}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{fr.featuredPicker.none}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-extrabold">{fr.featuredPicker.candidates}</h2>
        {candidates?.length === 0 && (
          <p className="text-sm text-muted-foreground">{fr.featuredPicker.noCandidates}</p>
        )}
        <ul className="flex flex-col gap-2">
          {candidates?.map((cause) => (
            <li
              key={cause.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <strong className="font-heading">{cause.title}</strong>
                <span className="text-sm text-muted-foreground">
                  {cause.organization} · {fr.categories[cause.category]} ·{" "}
                  {fr.featuredPicker.progress(cause.percent)}
                  {cause.urgent && ` · ${fr.common.urgent}`}
                </span>
              </div>
              {cause.featured ? (
                <span className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-brand-orange-strong">
                  ♥ {fr.featuredPicker.isFeatured}
                </span>
              ) : (
                <Button size="sm" disabled={pending !== null} onClick={() => choose(cause.id)}>
                  {pending === cause.id ? fr.common.loading : fr.featuredPicker.choose}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
