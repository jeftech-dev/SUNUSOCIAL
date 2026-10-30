"use client";

import { useAction, useMutation } from "convex/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUiError } from "@/lib/errors";
import { communesOf, REGIONS } from "@/lib/geo";
import { fr } from "@/lib/strings.fr";
import {
  HOSPITAL_TYPE,
  METHODS,
  STRUCTURE_TYPES,
  type Method,
  type StructureType,
} from "@/lib/types";
import {
  isValidPassword,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation";

import { OtpStep } from "./OtpStep";

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

type FieldName =
  | "organizationName"
  | "responsibleName"
  | "responsiblePhone"
  | "email"
  | "password"
  | "receipt"
  | "payoutNumber"
  | "holderName";

/**
 * Structure / hospital signup, phase 1 (PARCOURS S09, S10). Structures prove their payout number
 * with an SMS code; hospitals have no payout account. The dossier then waits for a moderator.
 */
export function OrganizationSignupForm() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const sendCode = useAction(api.otp.send);
  const register = useAction(api.auth.registerOrganization);

  const [organizationName, setOrganizationName] = useState("");
  const [type, setType] = useState<StructureType>(STRUCTURE_TYPES[0]);
  const [region, setRegion] = useState<string>(REGIONS[0]);
  const [commune, setCommune] = useState<string>(communesOf(REGIONS[0])[0]);
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [method, setMethod] = useState<Method>("orange_money");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [holderName, setHolderName] = useState("");

  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [receiptFileId, setReceiptFileId] = useState<Id<"_storage"> | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isHospital = type === HOSPITAL_TYPE;

  function validate() {
    const next: Partial<Record<FieldName, string>> = {};
    const clean = {
      organizationName: normalizeName(organizationName),
      responsibleName: normalizeName(responsibleName),
      responsiblePhone: normalizePhone(responsiblePhone),
      email: normalizeEmail(email),
      payoutNumber: normalizePhone(payoutNumber),
      holderName: normalizeName(holderName),
    };
    if (!clean.organizationName) next.organizationName = fr.errors.invalidName;
    if (!clean.responsibleName) next.responsibleName = fr.errors.invalidName;
    if (!clean.responsiblePhone) next.responsiblePhone = fr.errors.invalidPhone;
    if (!clean.email) next.email = fr.errors.invalidEmail;
    if (!isValidPassword(password, "organization")) {
      next.password = fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.organization);
    }
    if (!receipt && !receiptFileId) next.receipt = fr.errors.receiptRequired;
    else if (
      receipt &&
      (receipt.size > RECEIPT_MAX_BYTES || !RECEIPT_TYPES.includes(receipt.type))
    ) {
      next.receipt = fr.errors.receiptInvalid;
    }
    if (!isHospital) {
      if (!clean.payoutNumber) next.payoutNumber = fr.errors.invalidPhone;
      if (!clean.holderName) next.holderName = fr.errors.invalidName;
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? clean : null;
  }

  async function uploadReceipt(): Promise<Id<"_storage">> {
    if (receiptFileId) return receiptFileId;
    if (!receipt) throw new Error("missing receipt");
    const url = await generateUploadUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": receipt.type },
      body: receipt,
    });
    if (!response.ok) throw new Error("upload failed");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    setReceiptFileId(storageId);
    return storageId;
  }

  async function submitDossier(otpCode?: string): Promise<string | null> {
    const clean = validate();
    if (!clean) return fr.errors.generic;
    try {
      const fileId = await uploadReceipt();
      await register({
        organizationName: clean.organizationName!,
        type,
        region,
        commune,
        responsibleName: clean.responsibleName!,
        responsiblePhone: clean.responsiblePhone!,
        email: clean.email!,
        password,
        receiptFileId: fileId,
        payout:
          isHospital || !otpCode
            ? undefined
            : {
                method,
                accountNumber: clean.payoutNumber!,
                holderName: clean.holderName!,
                otpCode,
              },
      });
      setDone(true);
      return null;
    } catch (e) {
      return toUiError(e).message;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = validate();
    if (!clean) return;
    setPending(true);
    setFormError(null);
    try {
      if (isHospital) {
        setFormError(await submitDossier());
      } else {
        await uploadReceipt();
        const result = await sendCode({ purpose: "payout_number", phone: clean.payoutNumber! });
        setSentTo(result.to);
      }
    } catch (e) {
      setFormError(toUiError(e).message);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h2 className="text-2xl font-bold text-brand-blue">{fr.auth.signup.sent.title}</h2>
        <p className="text-muted-foreground">{fr.auth.signup.sent.body}</p>
        <Button asChild size="lg">
          <Link href="/connexion?role=org">{fr.auth.signup.sent.login}</Link>
        </Button>
      </div>
    );
  }

  if (sentTo) {
    return (
      <OtpStep
        to={sentTo}
        submitLabel={fr.auth.otp.verify}
        onSubmit={(code) => submitDossier(code)}
        onResend={async () => {
          const phone = normalizePhone(payoutNumber);
          if (!phone) return;
          setSentTo((await sendCode({ purpose: "payout_number", phone })).to);
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={formError} />
      <Field label={fr.auth.fields.organizationName} error={errors.organizationName}>
        {(props) => (
          <Input
            {...props}
            autoComplete="organization"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        )}
      </Field>
      <Field label={fr.auth.fields.structureType}>
        {(props) => (
          <NativeSelect
            {...props}
            value={type}
            onChange={(e) => setType(e.target.value as StructureType)}
          >
            {STRUCTURE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      {isHospital && (
        <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          {fr.auth.signup.hospitalNote}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label={fr.foundations.commune}>
          {(props) => (
            <NativeSelect {...props} value={commune} onChange={(e) => setCommune(e.target.value)}>
              {communesOf(region).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      <Field label={fr.auth.fields.holderName} error={errors.responsibleName}>
        {(props) => (
          <Input
            {...props}
            autoComplete="name"
            value={responsibleName}
            onChange={(e) => {
              setResponsibleName(e.target.value);
              if (!holderName) setHolderName(e.target.value);
            }}
          />
        )}
      </Field>
      <Field label={fr.auth.fields.responsiblePhone} error={errors.responsiblePhone}>
        {(props) => (
          <Input
            {...props}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={fr.auth.fields.phonePlaceholder}
            value={responsiblePhone}
            onChange={(e) => setResponsiblePhone(e.target.value)}
          />
        )}
      </Field>
      <Field label={fr.auth.fields.email} error={errors.email}>
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
      <Field
        label={fr.auth.fields.password}
        hint={fr.auth.signup.orgPasswordHint}
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
      <Field
        label={fr.auth.fields.receipt}
        hint={fr.auth.fields.receiptHint}
        error={errors.receipt}
      >
        {(props) => (
          <Input
            {...props}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="h-auto py-2.5"
            onChange={(e) => {
              setReceipt(e.target.files?.[0] ?? null);
              setReceiptFileId(null);
            }}
          />
        )}
      </Field>

      {!isHospital && (
        <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">{fr.auth.fields.payoutTitle}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 rounded-lg border-[1.5px] border-input px-3 py-2.5 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
              >
                <input
                  type="radio"
                  name="payout-method"
                  className="accent-[var(--brand-blue)]"
                  checked={method === m}
                  onChange={() => setMethod(m)}
                />
                {fr.methods[m]}
              </label>
            ))}
          </div>
          <Field label={fr.auth.fields.payoutNumber} error={errors.payoutNumber}>
            {(props) => (
              <Input
                {...props}
                type="tel"
                inputMode="tel"
                placeholder={fr.auth.fields.phonePlaceholder}
                value={payoutNumber}
                onChange={(e) => setPayoutNumber(e.target.value)}
              />
            )}
          </Field>
          <Field label={fr.auth.fields.holderName} error={errors.holderName}>
            {(props) => (
              <Input
                {...props}
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            )}
          </Field>
          <p className="text-xs text-muted-foreground">{fr.auth.fields.payoutHint}</p>
        </fieldset>
      )}

      <Button type="submit" variant="cta" size="lg" disabled={pending}>
        {pending
          ? fr.common.loading
          : isHospital
            ? fr.auth.signup.submitOrg
            : fr.auth.signup.sendCode}
      </Button>
      <p className="text-xs text-muted-foreground">{fr.auth.signup.terms}</p>
    </form>
  );
}
