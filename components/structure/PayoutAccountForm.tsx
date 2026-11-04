"use client";

import { useAction, useMutation } from "convex/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { METHODS, type Method } from "@/lib/types";

/**
 * Lets a structure change its payout account (S10, DT-5): confirm the new number by SMS, then submit.
 * The change lands in `payoutPending` and a moderator must approve it before it takes effect.
 */
export function PayoutAccountForm() {
  const sendCode = useAction(api.otp.send);
  const requestChange = useMutation(api.structures.requestPayoutChange);

  const [method, setMethod] = useState<Method>("wave");
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await sendCode({ purpose: "payout_number", phone: number.trim() });
      setSent(res.to);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestChange({
        payout: {
          method,
          accountNumber: number.trim(),
          holderName: holder.trim(),
          otpCode: code.trim(),
        },
      });
      setDone(true);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-4">
      <h2 className="font-heading text-lg font-bold text-brand-blue">{fr.payoutChange.heading}</h2>
      <p className="text-sm text-muted-foreground">{fr.payoutChange.intro}</p>

      {done ? (
        <p
          role="status"
          className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-brand-green-strong"
        >
          {fr.payoutChange.submitted}
        </p>
      ) : (
        <>
          <label className="text-sm font-semibold" htmlFor="payout-method">
            {fr.payoutChange.methodLabel}
          </label>
          <select
            id="payout-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {fr.methods[m]}
              </option>
            ))}
          </select>

          <label className="text-sm font-semibold" htmlFor="payout-number">
            {fr.payoutChange.numberLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="payout-number"
              value={number}
              inputMode="tel"
              onChange={(e) => setNumber(e.target.value)}
              className="w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !number.trim()}
              onClick={onSendCode}
            >
              {fr.payoutChange.sendCode}
            </Button>
          </div>
          {sent && (
            <p className="text-xs text-brand-green-strong">{fr.payoutChange.codeSent(sent)}</p>
          )}

          <label className="text-sm font-semibold" htmlFor="payout-holder">
            {fr.payoutChange.holderLabel}
          </label>
          <input
            id="payout-holder"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            className="w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
          />

          <label className="text-sm font-semibold" htmlFor="payout-code">
            {fr.payoutChange.codeLabel}
          </label>
          <input
            id="payout-code"
            value={code}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg border-[1.5px] border-input bg-card p-2.5 text-sm"
          />

          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <Button
            variant="cta"
            size="sm"
            className="self-start"
            disabled={busy || !number.trim() || !holder.trim() || !code.trim()}
            onClick={onSubmit}
          >
            {fr.payoutChange.submit}
          </Button>
        </>
      )}
    </section>
  );
}
