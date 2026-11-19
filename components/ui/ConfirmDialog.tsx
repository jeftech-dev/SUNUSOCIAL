"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { fr } from "@/lib/strings.fr";

/**
 * Branded replacement for `window.confirm` / `window.prompt`. With `reasonLabel` it asks for a
 * required free-text reason and hands it to `onConfirm`. Escape, the backdrop and the cancel
 * button all call `onCancel`.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  reasonLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const reasonId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  useDialogFocus(dialogRef, onCancel);

  const needsReason = reasonLabel !== undefined;
  const canConfirm = !needsReason || reason.trim() !== "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.55)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-card p-5 outline-none sm:rounded-2xl"
      >
        <strong id={titleId} className="font-heading text-lg leading-tight text-brand-blue">
          {title}
        </strong>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
        {needsReason && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold" htmlFor={reasonId}>
              {reasonLabel}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20 w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {fr.common.cancel}
          </Button>
          <Button variant="cta" disabled={!canConfirm} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
