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

/** A second code sent to another number in the same step (organisation signup). */
export interface SecondCode {
  to: string;
  firstLabel: string;
  secondLabel: string;
}

/**
 * "Code reçu par SMS" step. `onSubmit` returns an error message to show, or null on success.
 * With `second`, two codes are asked for, one per number. Resend is available after 60 s (the
 * server enforces it too).
 */
export function OtpStep({
  to,
  second,
  submitLabel,
  onSubmit,
  onResend,
  children,
}: {
  to: string;
  second?: SecondCode;
  submitLabel: string;
  onSubmit: (code: string, secondCode?: string) => Promise<string | null>;
  onResend: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [secondCode, setSecondCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_DELAY_MS);
  const wait = useCountdown(resendAt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isOtpFormat(code) || (second && !isOtpFormat(secondCode))) {
      setError(fr.errors.otpInvalid);
      return;
    }
    setPending(true);
    setError(null);
    try {
      setError(await onSubmit(code, second ? secondCode : undefined));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await onResend();
      setCode("");
      setSecondCode("");
      setResendAt(Date.now() + RESEND_DELAY_MS);
    } catch (e) {
      setError(toUiError(e).message);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {second ? fr.auth.otp.sentToBoth(to, second.to) : fr.auth.otp.sentTo(to)}
      </p>
      {second && <FormError message={error} />}
      <Field label={second ? second.firstLabel : fr.auth.fields.code} error={second ? null : error}>
        {(props) => <CodeInput {...props} value={code} onChange={setCode} autoFocus />}
      </Field>
      {second && (
        <Field label={second.secondLabel}>
          {(props) => <CodeInput {...props} value={secondCode} onChange={setSecondCode} />}
        </Field>
      )}
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

function CodeInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      pattern="\d{6}"
      className="text-center font-heading text-2xl tracking-[0.5em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}

export { FormError };
