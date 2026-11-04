"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { FormError } from "@/components/forms/Field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useMe } from "@/hooks/useMe";
import { toUiError } from "@/lib/errors";
import { communesOf } from "@/lib/geo";
import { fr } from "@/lib/strings.fr";
import {
  BLOOD_ALERT_LEVELS,
  KNOWN_BLOOD_TYPES,
  type BloodAlertLevel,
  type BloodType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-destructive bg-destructive text-white"
          : "bg-card hover:bg-[var(--danger-soft)]",
      )}
    >
      {children}
    </button>
  );
}

/** 10 Émettre une alerte (PARCOURS S28): groups, urgency, bags, communes, channels, live reach. */
export function AlertComposer() {
  const me = useMe();
  const create = useMutation(api.blood.createAlert);
  const region = me?.structure?.region ?? "";
  const approved = me?.structure?.status === "approved" && me.structure.suspendedAt === undefined;

  const [groups, setGroups] = useState<BloodType[]>([]);
  const [anyType, setAnyType] = useState(false);
  const [level, setLevel] = useState<BloodAlertLevel>("vitale");
  const [units, setUnits] = useState("");
  const [communes, setCommunes] = useState<string[]>([]);
  const [sms, setSms] = useState(true);
  const [inApp, setInApp] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const preview = useQuery(
    api.blood.previewRecipients,
    approved && communes.length > 0
      ? { bloodTypes: anyType ? [] : groups, anyType, targetCommunes: communes }
      : "skip",
  );
  const unitsNumber = Number(units);
  const valid =
    (anyType || groups.length > 0) &&
    Number.isInteger(unitsNumber) &&
    unitsNumber >= 1 &&
    communes.length > 0 &&
    (sms || inApp);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await create({
        bloodTypes: anyType ? [] : groups,
        anyType,
        level,
        unitsNeeded: unitsNumber,
        targetCommunes: communes,
        channels: { inApp, sms },
      });
      setSent(result.estimatedRecipients);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setSent(null);
    setGroups([]);
    setAnyType(false);
    setUnits("");
    setCommunes([]);
  }

  if (!me) return null;
  if (!approved) {
    return (
      <p role="status" className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
        {fr.errors.hospitalNotApproved}
      </p>
    );
  }

  if (sent !== null) {
    return (
      <section role="status" className="flex flex-col gap-3 rounded-xl bg-success-soft p-6">
        <h1 className="font-heading text-2xl font-extrabold text-brand-green-strong">
          {fr.blood.composer.sentTitle}
        </h1>
        <p className="text-sm">{fr.blood.composer.sentBody(sent)}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={reset}>
            {fr.blood.composer.another}
          </Button>
          <Link href="/hopital" className={buttonVariants({ variant: "cta" })}>
            {fr.blood.composer.dashboard}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-extrabold text-brand-blue">
          {fr.blood.composer.title}
        </h1>
        <p className="text-muted-foreground">{fr.blood.composer.intro}</p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{fr.blood.composer.groups}</legend>
        <div className="grid grid-cols-4 gap-2">
          {KNOWN_BLOOD_TYPES.map((type) => (
            <ToggleButton
              key={type}
              active={!anyType && groups.includes(type)}
              onClick={() => {
                setAnyType(false);
                setGroups((g) => toggle(g, type));
              }}
            >
              {fr.bloodTypes[type]}
            </ToggleButton>
          ))}
        </div>
        <div>
          <ToggleButton active={anyType} onClick={() => setAnyType((v) => !v)}>
            {fr.blood.allGroupsToggle}
          </ToggleButton>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{fr.blood.composer.level}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {BLOOD_ALERT_LEVELS.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col rounded-lg border p-3 text-sm has-[:checked]:border-destructive has-[:checked]:bg-[var(--danger-soft)]"
            >
              <span className="flex items-center gap-2 font-bold">
                <input
                  type="radio"
                  name="level"
                  className="size-4 accent-[var(--destructive)]"
                  checked={level === value}
                  onChange={() => setLevel(value)}
                />
                {fr.bloodAlertLevels[value]}
              </span>
              <span className="text-muted-foreground">{fr.bloodAlertLevelHints[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="alert-units" className="text-sm font-semibold">
          {fr.blood.composer.units}
        </label>
        <Input
          id="alert-units"
          inputMode="numeric"
          className="max-w-40"
          value={units}
          onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{fr.blood.composer.communes(region)}</legend>
        <div className="flex flex-wrap gap-2">
          {communesOf(region).map((commune) => (
            <ToggleButton
              key={commune}
              active={communes.includes(commune)}
              onClick={() => setCommunes((c) => toggle(c, commune))}
            >
              {commune}
              {preview && communes.includes(commune) && (
                <span className="ml-1.5 font-normal">
                  ({preview.perCommune.find((p) => p.commune === commune)?.count ?? 0})
                </span>
              )}
            </ToggleButton>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{fr.blood.composer.communesHint}</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{fr.blood.composer.channels}</legend>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-[var(--brand-blue)]"
            checked={sms}
            onChange={(e) => setSms(e.target.checked)}
          />
          {fr.blood.composer.channelSms}
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-[var(--brand-blue)]"
            checked={inApp}
            onChange={(e) => setInApp(e.target.checked)}
          />
          {fr.blood.composer.channelApp}
        </label>
      </fieldset>

      <div aria-live="polite" className="rounded-xl bg-[var(--danger-soft)] p-4">
        {communes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.blood.composer.reachNoCommune}</p>
        ) : (
          <p className="text-sm">
            <strong className="font-heading text-2xl text-destructive">
              {preview?.total ?? "…"}
            </strong>{" "}
            {preview && fr.blood.composer.reach(preview.total)}{" "}
            {fr.blood.composer.reachSuffix(communes.join(", "))}
          </p>
        )}
      </div>

      <FormError message={error} />
      <Button variant="destructive" size="lg" disabled={!valid || pending} onClick={submit}>
        {pending ? fr.blood.composer.sending : fr.blood.composer.send}
      </Button>
    </div>
  );
}
