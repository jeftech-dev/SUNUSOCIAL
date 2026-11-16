"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The dialog's Tab stops in order. A native radio group is a single stop in the browser (the
 * focused radio, else the checked one, else the first), so it counts once here too.
 */
function tabStops(dialog: HTMLElement, active: Element | null): HTMLElement[] {
  const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const groups = new Map<string, HTMLInputElement[]>();
  for (const item of items) {
    if (!isGroupedRadio(item)) continue;
    groups.set(item.name, [...(groups.get(item.name) ?? []), item]);
  }
  return items.filter((item) => {
    if (!isGroupedRadio(item)) return true;
    const group = groups.get(item.name)!;
    const stop =
      group.find((radio) => radio === active) ?? group.find((radio) => radio.checked) ?? group[0];
    return item === stop;
  });
}

function isGroupedRadio(item: HTMLElement): item is HTMLInputElement {
  return item instanceof HTMLInputElement && item.type === "radio" && item.name !== "";
}

/**
 * Modal keyboard behaviour: focus moves into the dialog on open (unless something inside already
 * has it), Escape closes, Tab stays inside, and focus returns to the opener on close.
 * `onClose` is read through a ref so a new callback on every parent render never re-runs the effect.
 */
export function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const active = document.activeElement;
      const stops = tabStops(dialog, active);
      if (stops.length === 0) {
        event.preventDefault();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const index = stops.indexOf(active as HTMLElement);
      if (index === -1) {
        // Focus is on the dialog itself, or was lost to <body> when the focused control was
        // disabled or unmounted: bring it back inside instead of letting it reach the page behind.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && index === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && index === stops.length - 1) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [dialogRef]);
}
