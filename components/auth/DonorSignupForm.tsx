"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  BloodProfileFields,
  DEFAULT_BLOOD_PROFILE,
  type BloodProfileValue,
} from "@/components/blood/BloodProfileFields";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import {
  isValidPassword,
  normalizeName,
  normalizePhone,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation";

import { OtpStep } from "./OtpStep";

type Errors = Partial<Record<"name" | "phone" | "password" | "commune", string>>;

/** Donor signup (PARCOURS S02): the account is created only once the SMS code is verified. */
export function DonorSignupForm() {
  const sendCode = useAction(api.otp.send);
  const register = useAction(api.auth.registerDonor);
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [blood, setBlood] = useState<BloodProfileValue>(DEFAULT_BLOOD_PROFILE);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function validate(): { name: string; phone: string } | null {
    const next: Errors = {};
    const cleanName = normalizeName(name);
    const cleanPhone = normalizePhone(phone);
    if (!cleanName) next.name = fr.errors.invalidName;
    if (!cleanPhone) next.phone = fr.errors.invalidPhone;
    if (!isValidPassword(password, "donor")) {
      next.password = fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.donor);
    }
    setErrors(next);
    return cleanName && cleanPhone && Object.keys(next).length === 0
      ? { name: cleanName, phone: cleanPhone }
      : null;
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const valid = validate();
    if (!valid) return;
    setPending(true);
    setFormError(null);
    try {
      const result = await sendCode({ purpose: "donor_signup", phone: valid.phone });
      setSentTo(result.to);
    } catch (e) {
      const err = toUiError(e);
      if (err.field === "phone") setErrors({ phone: err.message });
      else setFormError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function verifyAndCreate(code: string): Promise<string | null> {
    const valid = validate();
    if (!valid) return fr.errors.generic;
    try {
      await register({
        name: valid.name,
        phone: valid.phone,
        password,
        otpCode: code,
        bloodProfile: {
          optIn: blood.optIn,
          bloodType: blood.optIn ? blood.bloodType : undefined,
          region: blood.region,
          commune: blood.commune,
          smsOptIn: blood.optIn && blood.smsOptIn,
        },
      });
    } catch (e) {
      return toUiError(e).message;
    }
    try {
      await signIn("password", { flow: "signIn", identifier: valid.phone, password });
      router.replace("/causes");
    } catch {
      router.replace("/connexion");
    }
    return null;
  }

  if (sentTo) {
    return (
      <OtpStep
        to={sentTo}
        submitLabel={fr.auth.otp.verify}
        onSubmit={verifyAndCreate}
        onResend={async () => {
          const valid = validate();
          if (!valid) return;
          const result = await sendCode({ purpose: "donor_signup", phone: valid.phone });
          setSentTo(result.to);
        }}
      />
    );
  }

  return (
    <form onSubmit={requestCode} className="flex flex-col gap-4" noValidate>
      <FormError message={formError} />
      <Field label={fr.auth.fields.fullName} error={errors.name}>
        {(props) => (
          <Input
            {...props}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      <Field label={fr.auth.fields.phone} error={errors.phone}>
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
      <Field
        label={fr.auth.fields.password}
        hint={fr.auth.signup.donorPasswordHint}
        error={errors.password}
      >
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>

      <BloodProfileFields value={blood} onChange={setBlood} communeError={errors.commune} />

      <Button type="submit" variant="cta" size="lg" disabled={pending}>
        {pending ? fr.common.loading : fr.auth.signup.sendCode}
      </Button>
      <p className="text-xs text-muted-foreground">{fr.auth.signup.terms}</p>
    </form>
  );
}
