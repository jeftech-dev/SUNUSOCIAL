"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import {
  isValidPassword,
  normalizeEmail,
  normalizePhone,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation";

import { AccountTabs, type AccountKind } from "./AccountTabs";
import { OtpStep } from "./OtpStep";

/** "Mot de passe oublié" (PARCOURS S04). Never reveals whether an account exists. */
export function ResetPasswordForm({
  initialKind = "donor",
  showTabs = true,
}: {
  initialKind?: AccountKind;
  showTabs?: boolean;
}) {
  const [kind, setKind] = useState<AccountKind>(initialKind);
  return (
    <div className="flex flex-col gap-6">
      {showTabs && <AccountTabs value={kind} onChange={setKind} />}
      <h1 className="text-2xl font-bold text-brand-blue">{fr.auth.reset.title}</h1>
      {kind === "donor" ? <DonorReset /> : <EmailReset />}
    </div>
  );
}

function DonorReset() {
  const sendCode = useAction(api.otp.send);
  const reset = useAction(api.passwordReset.resetWithSmsCode);
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const clean = normalizePhone(phone);
    if (!clean) {
      setError(fr.errors.invalidPhone);
      return;
    }
    setPending(true);
    setError(null);
    try {
      setSentTo((await sendCode({ purpose: "password_reset", phone: clean })).to);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    const clean = normalizePhone(phone)!;
    return (
      <OtpStep
        to={sentTo}
        submitLabel={fr.auth.reset.submitDonor}
        onSubmit={async (code) => {
          if (!isValidPassword(newPassword, "donor")) {
            return fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.donor);
          }
          try {
            await reset({ phone: clean, code, newPassword });
          } catch (e) {
            return toUiError(e).message;
          }
          try {
            await signIn("password", { flow: "signIn", identifier: clean, password: newPassword });
            router.replace("/causes");
          } catch {
            router.replace("/connexion");
          }
          return null;
        }}
        onResend={async () => {
          setSentTo((await sendCode({ purpose: "password_reset", phone: clean })).to);
        }}
      >
        <Field label={fr.auth.fields.newPassword} hint={fr.auth.signup.donorPasswordHint}>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          )}
        </Field>
      </OtpStep>
    );
  }

  return (
    <form onSubmit={requestCode} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">{fr.auth.reset.donorIntro}</p>
      <FormError message={error} />
      <Field label={fr.auth.fields.phone}>
        {(props) => (
          <Input
            {...props}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={fr.auth.fields.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="cta" size="lg" disabled={pending}>
        {pending ? fr.common.loading : fr.auth.signup.sendCode}
      </Button>
    </form>
  );
}

function EmailReset() {
  const request = useAction(api.passwordReset.requestEmailReset);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = normalizeEmail(email);
    if (!clean) {
      setError(fr.errors.invalidEmail);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await request({ email: clean });
      setSent(true);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <p
        role="status"
        className="rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-success"
      >
        {fr.auth.reset.linkSent}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">{fr.auth.reset.orgIntro}</p>
      <FormError message={error} />
      <Field label={fr.auth.fields.email}>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="cta" size="lg" disabled={pending}>
        {pending ? fr.common.loading : fr.auth.reset.sendLink}
      </Button>
    </form>
  );
}
