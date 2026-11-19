"use client";

import { useMutation } from "convex/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/dates";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { KNOWN_BLOOD_TYPES, type BloodType } from "@/lib/types";
import { cn } from "@/lib/utils";

import { NoticeBanner, type Notice } from "./BloodShared";

type Entry = { bloodType: BloodType; units: number };

/** Interim stock thresholds, from the prototype: ≤3 critical, ≤8 low. */
function stockLevel(units: number) {
  if (units <= 3) return { label: fr.blood.hospital.critical, bar: "bg-destructive" };
  if (units <= 8) return { label: fr.blood.hospital.low, bar: "bg-brand-orange" };
  return { label: fr.blood.hospital.ok, bar: "bg-brand-green" };
}

const BAR_FULL_AT = 20;

/** 09b Niveau des réserves: per-group stock, editable by hand (PARCOURS S25). */
export function StockPanel({ entries, updatedAt }: { entries: Entry[]; updatedAt: number | null }) {
  const update = useMutation(api.blood.updateStock);
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const startEdit = () => setDraft(Object.fromEntries(entries.map((e) => [e.bloodType, e.units])));
  const setUnits = (type: BloodType, units: number) =>
    setDraft((d) => (d ? { ...d, [type]: Math.max(0, Math.min(9999, units || 0)) } : d));

  async function save() {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      await update({
        entries: KNOWN_BLOOD_TYPES.map((bloodType) => ({
          bloodType,
          units: draft[bloodType] ?? 0,
        })),
      });
      setDraft(null);
      setNotice({ kind: "success", text: fr.blood.hospital.saved });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="blood-stock" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 id="blood-stock" className="font-heading text-xl font-bold text-brand-blue">
            {fr.blood.hospital.stockTitle}
          </h2>
          <span className="text-xs text-muted-foreground">
            {updatedAt
              ? fr.blood.hospital.stockUpdated(formatDate(updatedAt))
              : fr.blood.hospital.stockNever}
          </span>
        </div>
        {draft ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              {fr.blood.hospital.cancel}
            </Button>
            <Button variant="destructive" size="sm" disabled={saving} onClick={save}>
              {saving ? fr.common.loading : fr.blood.hospital.save}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startEdit}>
            {fr.blood.hospital.editStock}
          </Button>
        )}
      </div>
      <NoticeBanner notice={notice} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map((entry) => {
          const units = draft ? (draft[entry.bloodType] ?? 0) : entry.units;
          const level = stockLevel(units);
          const group = fr.bloodTypes[entry.bloodType];
          return (
            <li key={entry.bloodType} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between">
                <strong className="font-heading text-lg text-destructive">{group}</strong>
                <span className="text-xs font-semibold text-muted-foreground">{level.label}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full", level.bar)}
                  style={{ width: `${Math.min(100, (units / BAR_FULL_AT) * 100)}%` }}
                />
              </div>
              {draft ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={fr.blood.hospital.decrease(group)}
                    onClick={() => setUnits(entry.bloodType, units - 1)}
                    className="size-9 rounded-full border text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    −
                  </button>
                  <Input
                    inputMode="numeric"
                    aria-label={`${group}`}
                    className="h-9 text-center"
                    value={String(units)}
                    onChange={(e) => setUnits(entry.bloodType, Number(e.target.value))}
                  />
                  <button
                    type="button"
                    aria-label={fr.blood.hospital.increase(group)}
                    onClick={() => setUnits(entry.bloodType, units + 1)}
                    className="size-9 rounded-full border text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="text-sm">{fr.blood.hospital.units(units)}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{fr.blood.hospital.stockFootnote}</p>
    </section>
  );
}
