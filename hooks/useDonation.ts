"use client";

import { useAction } from "convex/react";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { config } from "@/lib/config";
import { toUiError } from "@/lib/errors";
import { computeFee } from "@/lib/money";
import type { FeeBreakdown, Method } from "@/lib/types";

/** Preset amounts offered in the modal (PARCOURS S18), plus a custom amount. */
export const DONATION_PRESETS = [500, 1000, 5000] as const;

export type DonationState = "idle" | "loading" | "error";

/**
 * Donation modal state: amount, method, the live fee/net preview, and `confirm`, which creates the
 * checkout and sends the browser to the provider. The fee shown here is a preview; the server
 * recomputes it authoritatively (DT-6).
 */
export function useDonation(cause: { id: string }) {
  const createCheckout = useAction(api.donations.createCheckout);
  const [amount, setAmount] = useState<number>(DONATION_PRESETS[1]);
  const [method, setMethod] = useState<Method>("wave");
  const [state, setState] = useState<DonationState>("idle");
  const [error, setError] = useState<string | null>(null);

  const valid = Number.isSafeInteger(amount) && amount >= config.minDonation;
  // The fee line is deducted from a valid amount; show zeros until the amount is valid.
  const breakdown: FeeBreakdown = computeFee(valid ? amount : 0, "naboopay");

  async function confirm() {
    if (!valid || state === "loading") return;
    setState("loading");
    setError(null);
    try {
      const result = await createCheckout({ causeId: cause.id, amount, method });
      // Leaving the app for the provider (mock: the in-app simulator).
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      setError(toUiError(e).message);
      setState("error");
    }
  }

  return {
    amount,
    setAmount,
    method,
    setMethod,
    breakdown,
    valid,
    minDonation: config.minDonation,
    state,
    error,
    confirm,
  };
}
