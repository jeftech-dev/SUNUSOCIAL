"use client";

import { useMutation } from "convex/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { slotLabel, slotOptions } from "@/lib/bloodSlots";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";

/** 08 Confirmer sa venue (PARCOURS S29): pick a 2-hour window, then confirm. */
export function SlotDialog({
  alertId,
  hospitalName,
  deadlineAt,
  onClose,
}: {
  alertId: Id<"bloodAlerts">;
  hospitalName: string;
  deadlineAt: number;
  onClose: () => void;
}) {
  const respond = useMutation(api.blood.respond);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Computed once on open, with the same shared module the server validates against.
  const [now] = useState(() => Date.now());
  const options = useMemo(() => slotOptions(now, deadlineAt), [now, deadlineAt]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // The parent passes a fresh `onClose` on every live update; reading it through a ref keeps the
  // mount effect below from re-running (and stealing focus back to the dialog) each time.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  async function confirm() {
    if (selected === null) return;
    setPending(true);
    setError(null);
    try {
      const result = await respond({ alertId, slotStart: selected });
      setDone(result.slotLabel);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setPending(false);
    }
  }

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
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {fr.blood.slot.title}
            </span>
            <strong id={titleId} className="font-heading text-lg leading-tight text-brand-blue">
              {hospitalName}
            </strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={fr.blood.slot.close}
            className="-mr-1 -mt-1 rounded-full px-2 text-2xl leading-none text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            ×
          </button>
        </div>

        {done ? (
          <div role="status" className="flex flex-col gap-3">
            <p className="font-heading text-lg font-bold text-brand-green-strong">
              {fr.blood.slot.doneTitle}
            </p>
            <p className="text-sm">{fr.blood.slot.doneBody(done, hospitalName)}</p>
            <Button variant="cta" onClick={onClose}>
              {fr.blood.slot.back}
            </Button>
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">{fr.blood.slot.question}</legend>
              {options.length === 0 && (
                <p className="text-sm text-muted-foreground">{fr.blood.slot.none}</p>
              )}
              {options.map((option) => (
                <label
                  key={option.start}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-brand-blue has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="slot"
                    className="size-4 accent-[var(--brand-blue)]"
                    checked={selected === option.start}
                    onChange={() => setSelected(option.start)}
                  />
                  {slotLabel(option.start, now)}
                </label>
              ))}
            </fieldset>
            <FormError message={error} />
            <Button variant="cta" disabled={selected === null || pending} onClick={confirm}>
              {pending ? fr.blood.slot.confirming : fr.blood.slot.confirm}
            </Button>
            <p className="text-xs text-muted-foreground">{fr.blood.slot.privacy}</p>
          </>
        )}
      </div>
    </div>
  );
}
