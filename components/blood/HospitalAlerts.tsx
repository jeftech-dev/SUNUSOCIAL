"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { KNOWN_BLOOD_TYPES, type BloodType } from "@/lib/types";

import { BloodProgress, GroupChips, LevelBadge, NoticeBanner, type Notice } from "./BloodShared";

type Overview = NonNullable<FunctionReturnType<typeof api.blood.hospitalOverview>>;
type HospitalAlert = Overview["alerts"][number];
type Responder = HospitalAlert["responders"][number];

/** 10 Alertes en cours: responders, attendance confirmation, closing and thanks (PARCOURS S30+). */
export function HospitalAlerts({
  alerts,
  hospitalName,
}: {
  alerts: HospitalAlert[];
  hospitalName: string;
}) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const open = alerts.filter((a) => !a.closed);
  return (
    <section aria-labelledby="hospital-alerts" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="hospital-alerts" className="font-heading text-xl font-bold text-brand-blue">
          {fr.blood.hospital.alertsTitle}
          {open.length > 0 && (
            <span className="ml-2 text-sm font-semibold text-muted-foreground">
              ({open.length})
            </span>
          )}
        </h2>
        <Link
          href="/hopital/alerte"
          className={buttonVariants({ variant: "destructive", size: "sm" })}
        >
          {fr.blood.hospital.newAlert}
        </Link>
      </div>
      <NoticeBanner notice={notice} />
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {fr.blood.hospital.none}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <AlertRow
              key={alert._id}
              alert={alert}
              hospitalName={hospitalName}
              onNotice={setNotice}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertRow({
  alert,
  hospitalName,
  onNotice,
}: {
  alert: HospitalAlert;
  hospitalName: string;
  onNotice: (notice: Notice | null) => void;
}) {
  const close = useMutation(api.blood.closeAlert);
  const [showDonors, setShowDonors] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = alert.responders.filter((r) => r.status !== "cancelled");
  const donated = alert.responders.filter((r) => r.status === "donated");
  const goalReached = alert.unitsCollected >= alert.unitsNeeded;

  async function closeAlert() {
    if (!window.confirm(fr.blood.hospital.confirmClose)) return;
    setBusy(true);
    onNotice(null);
    try {
      await close({ alertId: alert._id });
    } catch (error) {
      onNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LevelBadge level={alert.level} />
        {alert.closed ? (
          <span className="text-sm font-bold text-muted-foreground">
            {fr.blood.hospital.closedBadge}
          </span>
        ) : goalReached ? (
          <span className="text-sm font-bold text-brand-green-strong">
            {fr.blood.hospital.goalReached}
          </span>
        ) : null}
      </div>
      <GroupChips groups={alert.bloodTypes} anyType={alert.anyType} />
      <p className="text-sm text-muted-foreground">
        {fr.blood.hospital.targeting(alert.targetCommunes.join(", "))}
      </p>
      <BloodProgress collected={alert.unitsCollected} needed={alert.unitsNeeded} />
      <p className="text-xs text-muted-foreground">
        {fr.blood.hospital.reached(alert.notifiedCount, active.length)}
      </p>
      {alert.closedByModerator && alert.closeReason && (
        <p
          role="status"
          className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-destructive"
        >
          {fr.blood.hospital.closedByModerator(alert.closeReason)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {alert.responders.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setShowDonors((v) => !v)}>
            {showDonors
              ? fr.blood.hospital.hideDonors
              : fr.blood.hospital.showDonors(alert.responders.length)}
          </Button>
        ) : (
          !alert.closed && (
            <span className="text-sm text-muted-foreground">{fr.blood.hospital.waiting}</span>
          )
        )}
        {!alert.closed && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={closeAlert}>
            {fr.blood.hospital.closeAlert}
          </Button>
        )}
      </div>

      {showDonors && (
        <ul className="flex flex-col gap-2">
          {alert.responders.map((responder) => (
            <ResponderRow key={responder.responseId} responder={responder} onNotice={onNotice} />
          ))}
        </ul>
      )}

      {(alert.closed || goalReached) && donated.length > 0 && (
        <ThanksBox
          alert={alert}
          hospitalName={hospitalName}
          donatedCount={donated.length}
          onNotice={onNotice}
        />
      )}
    </li>
  );
}

function ResponderRow({
  responder,
  onNotice,
}: {
  responder: Responder;
  onNotice: (notice: Notice | null) => void;
}) {
  const confirm = useMutation(api.blood.confirmDonation);
  const [busy, setBusy] = useState(false);
  const [onSite, setOnSite] = useState<BloodType | "">("");
  const unknownGroup = responder.bloodType === "unknown";

  async function confirmDonation() {
    setBusy(true);
    onNotice(null);
    try {
      const result = await confirm({
        responseId: responder.responseId as Id<"bloodResponses">,
        ...(unknownGroup && onSite ? { bloodType: onSite } : {}),
      });
      onNotice({
        kind: "success",
        text: fr.blood.hospital.donationDone(
          responder.firstName,
          fr.bloodTypes[result.bloodType],
          result.stockBefore,
          result.stockAfter,
        ),
      });
    } catch (error) {
      onNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-[var(--danger-soft)] text-xs font-bold text-destructive">
          {fr.bloodTypes[responder.bloodType]}
        </span>
        <div className="flex flex-col">
          <strong>{responder.firstName}</strong>
          <span className="text-muted-foreground">
            {responder.slotLabel} · {responder.commune}
          </span>
        </div>
      </div>
      {responder.status === "donated" ? (
        <span className="font-bold text-brand-green-strong">
          {fr.blood.hospital.donationConfirmed(fr.bloodTypes[responder.bloodType])}
        </span>
      ) : responder.status === "cancelled" ? (
        <span className="text-muted-foreground">{fr.blood.hospital.donorCancelled}</span>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {unknownGroup && (
            <NativeSelect
              aria-label={fr.blood.hospital.groupOnSite}
              value={onSite}
              onChange={(e) => setOnSite(e.target.value as BloodType)}
              className="h-9 w-auto"
            >
              <option value="">{fr.blood.hospital.groupOnSiteChoose}</option>
              {KNOWN_BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {fr.bloodTypes[type]}
                </option>
              ))}
            </NativeSelect>
          )}
          <Button
            variant="cta"
            size="sm"
            disabled={busy || (unknownGroup && !onSite)}
            onClick={confirmDonation}
          >
            {fr.blood.hospital.confirmDonation}
          </Button>
        </div>
      )}
    </li>
  );
}

function ThanksBox({
  alert,
  hospitalName,
  donatedCount,
  onNotice,
}: {
  alert: HospitalAlert;
  hospitalName: string;
  donatedCount: number;
  onNotice: (notice: Notice | null) => void;
}) {
  const send = useMutation(api.blood.sendThanks);
  const groups = alert.anyType
    ? fr.blood.allGroups
    : alert.bloodTypes.map((t) => fr.bloodTypes[t]).join(", ");
  const [message, setMessage] = useState(
    fr.blood.hospital.thanksDefault(hospitalName, alert.unitsCollected, groups),
  );
  const [busy, setBusy] = useState(false);

  if (alert.thanksSent) {
    return (
      <p className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-brand-green-strong">
        {fr.blood.hospital.thanksAlready}
      </p>
    );
  }

  async function sendThanks() {
    setBusy(true);
    onNotice(null);
    try {
      const result = await send({ alertId: alert._id, message });
      onNotice({ kind: "success", text: fr.blood.hospital.thanksSent(result.thanked) });
    } catch (error) {
      onNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-success-soft p-4">
      <label htmlFor={`thanks-${alert._id}`} className="text-sm font-bold text-brand-green-strong">
        {fr.blood.hospital.thanksTitle(donatedCount)}
      </label>
      <textarea
        id={`thanks-${alert._id}`}
        value={message}
        maxLength={300}
        onChange={(e) => setMessage(e.target.value)}
        className="min-h-24 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px]"
      />
      <p className="text-xs text-muted-foreground">{fr.blood.hospital.thanksNote}</p>
      <Button variant="cta" size="sm" disabled={busy} onClick={sendThanks} className="self-start">
        {fr.blood.hospital.thanksSend}
      </Button>
    </div>
  );
}
