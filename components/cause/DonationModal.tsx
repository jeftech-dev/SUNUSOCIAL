"use client";

import { useEffect, useId, useRef } from "react";

import { FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DONATION_PRESETS, useDonation } from "@/hooks/useDonation";
import { formatFCFA, PROVIDER_RATE } from "@/lib/money";
import { fr } from "@/lib/strings.fr";
import { METHODS, type Method } from "@/lib/types";
import { cn } from "@/lib/utils";

const RATE_LABEL = `${Math.round(PROVIDER_RATE.naboopay * 100)} %`;

/** 05 Modal de don (PARCOURS S18): amount presets + custom, method, live fee/net, confirm. */
export function DonationModal({
  cause,
  onClose,
}: {
  cause: { id: string; title: string; organization: string };
  onClose: () => void;
}) {
  const donation = useDonation(cause);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const customOn = !DONATION_PRESETS.includes(donation.amount as (typeof DONATION_PRESETS)[number]);

  // Close on Escape; focus the dialog on open; restore focus on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.55)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl bg-card p-5 outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold text-muted-foreground">
              {fr.donation.support(cause.organization)}
            </span>
            <strong id={titleId} className="font-heading text-lg leading-tight text-brand-blue">
              {cause.title}
            </strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={fr.donation.close}
            className="-mr-1 -mt-1 rounded-full px-2 text-2xl leading-none text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            ×
          </button>
        </div>

        {/* Amount */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">{fr.donation.amountLabel}</legend>
          <div className="grid grid-cols-4 gap-2">
            {DONATION_PRESETS.map((preset) => (
              <PillButton
                key={preset}
                active={!customOn && donation.amount === preset}
                onClick={() => donation.setAmount(preset)}
              >
                {formatFCFA(preset).replace(/ FCFA$/, "")}
              </PillButton>
            ))}
            <PillButton active={customOn} onClick={() => donation.setAmount(NaN)}>
              {fr.donation.other}
            </PillButton>
          </div>
          {customOn && (
            <div className="mt-1 flex items-center gap-2">
              <Input
                autoFocus
                inputMode="numeric"
                aria-label={fr.donation.otherLabel}
                aria-invalid={!donation.valid}
                placeholder={fr.donation.otherPlaceholder}
                value={Number.isNaN(donation.amount) ? "" : String(donation.amount)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  donation.setAmount(digits === "" ? NaN : Number(digits));
                }}
              />
              <span className="text-sm font-semibold text-muted-foreground">FCFA</span>
            </div>
          )}
          {!donation.valid && (
            <p className="text-xs text-muted-foreground">
              {fr.donation.minimum(formatFCFA(donation.minDonation))}
            </p>
          )}
        </fieldset>

        {/* Payment method */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">{fr.donation.methodLabel}</legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <PillButton
                key={m}
                active={donation.method === m}
                onClick={() => donation.setMethod(m as Method)}
              >
                {fr.methods[m]}
              </PillButton>
            ))}
          </div>
        </fieldset>

        {/* Fee breakdown (live preview, server recomputes) */}
        <div className="flex flex-col gap-1.5 rounded-lg bg-primary-soft p-3 text-sm">
          <div className="flex justify-between">
            <span>{fr.donation.yourGift}</span>
            <strong>{formatFCFA(donation.breakdown.amount)}</strong>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{fr.donation.fee(RATE_LABEL)}</span>
            <span>− {formatFCFA(donation.breakdown.fee)}</span>
          </div>
          <div className="my-1 border-t border-[var(--line-warm)]" />
          <div className="flex justify-between">
            <span>{fr.donation.structureReceives}</span>
            <strong className="text-brand-green-strong">
              {formatFCFA(donation.breakdown.net)}
            </strong>
          </div>
        </div>

        <FormError message={donation.error} />

        <Button
          type="button"
          variant="cta"
          size="lg"
          disabled={!donation.valid || donation.state === "loading"}
          onClick={donation.confirm}
        >
          {donation.state === "loading"
            ? fr.donation.redirecting
            : fr.donation.confirm(
                formatFCFA(donation.valid ? donation.amount : donation.minDonation),
              )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{fr.donation.secure}</p>
      </div>
    </div>
  );
}

function PillButton({
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
        "rounded-full border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-brand-blue bg-brand-blue text-white"
          : "border-input bg-card text-foreground hover:bg-primary-soft",
      )}
    >
      {children}
    </button>
  );
}
