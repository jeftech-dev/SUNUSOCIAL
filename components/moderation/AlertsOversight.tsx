"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import {
  BloodProgress,
  GroupChips,
  LevelBadge,
  NoticeBanner,
  type Notice,
} from "@/components/blood/BloodShared";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { cn } from "@/lib/utils";

/** Mod: every blood alert, with close-with-reason (DT-26; interim G13: the hospital gets the reason). */
export function AlertsOversight() {
  const alerts = useQuery(api.moderation.alerts);
  const closeAlert = useMutation(api.moderation.closeAlert);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<{ id: Id<"bloodAlerts">; text: string } | null>(null);

  async function confirmClose() {
    if (!reason) return;
    setBusy(true);
    setNotice(null);
    try {
      await closeAlert({ alertId: reason.id, reason: reason.text });
      setNotice({ kind: "success", text: fr.blood.moderation.done });
      setReason(null);
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setBusy(false);
    }
  }

  const shown = alerts?.filter((a) => (tab === "open" ? !a.closed : a.closed)) ?? [];
  const tabs = [
    { key: "open" as const, label: fr.blood.moderation.tabOpen },
    { key: "closed" as const, label: fr.blood.moderation.tabClosed },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-extrabold text-brand-blue">
          {fr.blood.moderation.title}
        </h1>
        <Link
          href="/file"
          className="text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
        >
          {fr.blood.moderation.back}
        </Link>
      </div>

      <div role="tablist" className="flex gap-2">
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
            {t.label}
          </button>
        ))}
      </div>

      <NoticeBanner notice={notice} />

      {reason && (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive bg-card p-4">
          <label className="text-sm font-semibold" htmlFor="close-reason">
            {fr.blood.moderation.reasonLabel}
          </label>
          <textarea
            id="close-reason"
            value={reason.text}
            autoFocus
            onChange={(e) => setReason((r) => (r ? { ...r, text: e.target.value } : r))}
            className="min-h-20 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px]"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReason(null)}>
              {fr.blood.moderation.cancel}
            </Button>
            <Button variant="cta" size="sm" disabled={busy} onClick={confirmClose}>
              {fr.blood.moderation.confirmClose}
            </Button>
          </div>
        </div>
      )}

      {alerts === undefined ? (
        <p className="text-sm text-muted-foreground">{fr.blood.moderation.loading}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {fr.blood.moderation.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((alert) => (
            <li
              key={alert._id}
              className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LevelBadge level={alert.level} />
                  <strong className="font-heading text-brand-blue">{alert.hospitalName}</strong>
                </div>
                <span className="text-xs text-muted-foreground">
                  {fr.blood.moderation.responders(alert.respondersCount)}
                </span>
              </div>
              <GroupChips groups={alert.bloodTypes} anyType={alert.anyType} />
              <p className="text-sm text-muted-foreground">
                {fr.blood.hospital.targeting(alert.targetCommunes.join(", "))}
              </p>
              <BloodProgress collected={alert.unitsCollected} needed={alert.unitsNeeded} />
              {alert.hospitalModeratorClosedCount > 0 && (
                <p className="text-xs font-semibold text-destructive">
                  {fr.blood.moderation.moderatorClosed(alert.hospitalModeratorClosedCount)}
                </p>
              )}
              {alert.closedByModerator && alert.closeReason && (
                <p className="text-sm text-muted-foreground">
                  {fr.blood.moderation.closedReason(alert.closeReason)}
                </p>
              )}
              {!alert.closed && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="self-start"
                  onClick={() => setReason({ id: alert._id, text: "" })}
                >
                  {fr.blood.moderation.close}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
