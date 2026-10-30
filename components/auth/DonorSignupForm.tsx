"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { communesOf, REGIONS } from "@/lib/geo";
import { fr } from "@/lib/strings.fr";
import { BLOOD_TYPES, type BloodType } from "@/lib/types";
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
  const [optIn, setOptIn] = useState(false);
  const [bloodType, setBloodType] = useState<BloodType>("unknown");
  const [region, setRegion] = useState<string>(REGIONS[0]);
  const [commune, setCommune] = useState<string>(communesOf(REGIONS[0])[0]);
  const [smsOptIn, setSmsOptIn] = useState(true);

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
          optIn,
          bloodType: optIn ? bloodType : undefined,
          region,
          commune,
          smsOptIn: optIn && smsOptIn,
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

      <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <legend className="px-1 text-sm font-semibold">{fr.auth.blood.title}</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-[var(--brand-blue)]"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          <span>
            <span className="font-semibold">{fr.auth.blood.optIn}</span>
            <span className="block text-muted-foreground">{fr.auth.blood.hint}</span>
          </span>
        </label>
        {optIn && (
          <>
            <Field label={fr.auth.blood.bloodType}>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value as BloodType)}
                >
                  {BLOOD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {fr.bloodTypes[type]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={fr.foundations.region}>
                {(props) => (
                  <NativeSelect
                    {...props}
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setCommune(communesOf(e.target.value)[0]);
                    }}
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label={fr.foundations.commune} error={errors.commune}>
                {(props) => (
                  <NativeSelect
                    {...props}
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                  >
                    {communesOf(region).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand-blue)]"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
              />
              {fr.auth.blood.sms}
            </label>
          </>
        )}
      </fieldset>

      <Button type="submit" variant="cta" size="lg" disabled={pending}>
        {pending ? fr.common.loading : fr.auth.signup.sendCode}
      </Button>
      <p className="text-xs text-muted-foreground">{fr.auth.signup.terms}</p>
    </form>
  );
}
