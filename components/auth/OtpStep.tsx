"use client";

import { useState, type FormEvent } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCountdown } from "@/hooks/useCountdown";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { isOtpFormat } from "@/lib/validation";

const RESEND_DELAY_MS = 60_000;

/**
 * "Code reçu par SMS" step. `onSubmit` returns an error message to show, or null on success.
 * Resend is available after 60 s (the server enforces it too).
 */
export function OtpStep({
  to,
  submitLabel,
  onSubmit,
  onResend,
  children,
}: {
  to: string;
  submitLabel: string;
  onSubmit: (code: string) => Promise<string | null>;
  onResend: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_DELAY_MS);
  const wait = useCountdown(resendAt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isOtpFormat(code)) {
      setError(fr.errors.otpInvalid);
      return;
    }
    setPending(true);
    setError(null);
    try {
      setError(await onSubmit(code));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await onResend();
      setCode("");
      setResendAt(Date.now() + RESEND_DELAY_MS);
    } catch (e) {
      setError(toUiError(e).message);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fr.auth.otp.sentTo(to)}
      </p>
      <Field label={fr.auth.fields.code} error={error}>
        {(props) => (
          <Input
            {...props}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            className="text-center font-heading text-2xl tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
          />
        )}
      </Field>
      {children}
      <Button type="submit" variant="cta" size="lg" disabled={pending}>
        {pending ? fr.common.loading : submitLabel}
      </Button>
      <Button type="button" variant="link" onClick={resend} disabled={wait > 0}>
        {wait > 0 ? fr.auth.otp.resendIn(wait) : fr.auth.otp.resend}
      </Button>
    </form>
  );
}

export { FormError };
