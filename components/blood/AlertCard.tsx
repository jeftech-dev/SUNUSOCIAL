"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/dates";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import type { BloodType } from "@/lib/types";

import { BloodProgress, GroupChips, LevelBadge, NoticeBanner, type Notice } from "./BloodShared";
import { SlotDialog } from "./SlotDialog";

export type DonorAlert = FunctionReturnType<typeof api.blood.alertsForDonor>["alerts"][number];

/** One hospital alert as the donor sees it (PARCOURS S27–S29). */
export function AlertCard({ alert, myType }: { alert: DonorAlert; myType: BloodType | null }) {
  const cancel = useMutation(api.blood.cancelResponse);
  const [slotOpen, setSlotOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function cancelVisit() {
    setCancelling(true);
    setNotice(null);
    try {
      await cancel({ alertId: alert._id });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LevelBadge level={alert.level} />
        <span className="text-xs text-muted-foreground">
          {fr.blood.donor.deadline(formatDate(alert.deadlineAt))}
        </span>
      </div>
      <div className="flex flex-col">
        <strong className="font-heading text-brand-blue">{alert.hospitalName}</strong>
        <span className="text-sm text-muted-foreground">
          {fr.blood.donor.sentTo(alert.hospitalCommune, alert.targetCommunes.join(", "))}
        </span>
      </div>
      <GroupChips groups={alert.bloodTypes} anyType={alert.anyType} mine={myType} />
      <BloodProgress collected={alert.unitsCollected} needed={alert.unitsNeeded} />
      <span className="text-xs text-muted-foreground">
        {fr.blood.donor.enRoute(alert.respondersCount)}
      </span>
      <NoticeBanner notice={notice} />
      {!alert.compatibleForMe ? (
        <p className="text-sm font-semibold text-muted-foreground">{fr.blood.donor.notRequested}</p>
      ) : alert.myResponse ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm font-bold text-brand-green-strong">
            {fr.blood.donor.confirmed(alert.myResponse.slotLabel)}
          </p>
          <Button variant="ghost" size="sm" disabled={cancelling} onClick={cancelVisit}>
            {cancelling ? fr.blood.donor.cancelling : fr.blood.donor.cancelVisit}
          </Button>
        </div>
      ) : (
        <Button variant="destructive" onClick={() => setSlotOpen(true)}>
          {fr.blood.donor.respond}
        </Button>
      )}
      {slotOpen && (
        <SlotDialog
          alertId={alert._id}
          hospitalName={alert.hospitalName}
          deadlineAt={alert.deadlineAt}
          onClose={() => setSlotOpen(false)}
        />
      )}
    </li>
  );
}
