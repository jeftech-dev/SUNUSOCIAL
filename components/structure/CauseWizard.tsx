"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFileUpload } from "@/hooks/useFileUpload";
import { config, DAY_MS } from "@/lib/config";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import {
  CATEGORIES,
  END_TYPES,
  type Category,
  type EndType,
  type OwnedCauseView,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TITLE_MIN = 4;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 20;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type FieldErrors = Partial<Record<string, string>>;

function toDateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fromDateInput(value: string): number {
  return new Date(`${value}T23:59:59`).getTime();
}

/**
 * Create a cause, or edit one that is still in moderation / was refused ("Modifier et renvoyer",
 * G6). On submit the cause is (re)sent to moderation. Pass `cause` to prefill the edit flow.
 */
export function CauseWizard({ cause }: { cause?: OwnedCauseView }) {
  const router = useRouter();
  const upload = useFileUpload();
  const createCause = useMutation(api.causes.create);
  const updateCause = useMutation(api.causes.update);
  const isEdit = cause !== undefined;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(cause?.title ?? "");
  const [description, setDescription] = useState(cause?.description ?? "");
  const [category, setCategory] = useState<Category>(cause?.category ?? CATEGORIES[0]);
  const [urgent, setUrgent] = useState(cause?.urgency === "urgent");
  const [file, setFile] = useState<File | null>(null);
  const [endType, setEndType] = useState<EndType>(cause?.endType ?? "date");
  const [goalAmount, setGoalAmount] = useState(cause ? String(cause.goalAmount) : "");
  const [deadline, setDeadline] = useState(cause ? toDateInput(cause.deadline) : "");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Captured once at mount: reading the clock during render is impure. The server re-validates the
  // deadline against its own clock, so a little drift here is harmless.
  const [now] = useState(() => Date.now());
  const minDate = toDateInput(now + DAY_MS);
  const maxDate = toDateInput(now + config.maxCauseDurationDays * DAY_MS);

  const validateStep = (index: number): boolean => {
    const next: FieldErrors = {};
    if (index === 0) {
      const t = title.trim();
      if (t.length < TITLE_MIN || t.length > TITLE_MAX) next.title = fr.errors.causeTitleInvalid;
      if (description.trim().length < DESCRIPTION_MIN) {
        next.description = fr.errors.causeDescriptionInvalid;
      }
    }
    if (index === 1 && !isEdit && !file) {
      next.banner = fr.errors.receiptRequired;
    }
    if (index === 2) {
      const amount = Number(goalAmount);
      if (!Number.isSafeInteger(amount) || amount <= 0) next.goalAmount = fr.errors.causeGoalInvalid;
      const ms = deadline ? fromDateInput(deadline) : 0;
      if (!deadline || ms <= now || ms > now + config.maxCauseDurationDays * DAY_MS) {
        next.deadline = fr.errors.causeDeadlineInvalid(config.maxCauseDurationDays);
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onPickFile = (picked: File | null) => {
    setErrors((e) => ({ ...e, banner: undefined }));
    if (picked && (!IMAGE_TYPES.includes(picked.type) || picked.size > IMAGE_MAX_BYTES)) {
      setFile(null);
      setErrors((e) => ({ ...e, banner: fr.errors.uploadInvalid }));
      return;
    }
    setFile(picked);
  };

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 2));
  };

  const submit = async () => {
    if (!validateStep(2)) return;
    setSubmitting(true);
    setFormError(null);
    try {
      let bannerFileId: Id<"_storage"> | undefined;
      if (file) bannerFileId = await upload(file);

      const base = {
        title: title.trim(),
        description: description.trim(),
        category,
        endType,
        goalAmount: Number(goalAmount),
        deadline: fromDateInput(deadline),
        urgency: urgent ? ("urgent" as const) : ("normal" as const),
      };

      if (isEdit) {
        await updateCause({ causeId: cause.id, ...base, bannerFileId });
      } else {
        await createCause({ ...base, bannerFileId: bannerFileId! });
      }
      setDone(true);
    } catch (error) {
      const ui = toUiError(error);
      setFormError(ui.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="flex flex-col items-start gap-4" aria-live="polite">
        <h1 className="font-heading text-2xl font-extrabold text-brand-blue">
          {fr.createCause.title}
        </h1>
        <p className="rounded-lg bg-success-soft p-4 text-sm font-semibold text-brand-green-strong">
          {fr.createCause.done}
        </p>
        <Button variant="cta" asChild>
          <Link href="/structure">{fr.structureCauses.heading}</Link>
        </Button>
      </section>
    );
  }

  const inputClass =
    "min-h-28 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px] text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive";

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-extrabold text-brand-blue">
          {fr.createCause.title}
        </h1>
        <p className="text-muted-foreground">{fr.createCause.intro}</p>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm">
        {fr.createCause.steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1 font-semibold",
              i === step
                ? "bg-primary-soft text-brand-blue"
                : i < step
                  ? "text-brand-green-strong"
                  : "text-muted-foreground",
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <FormError message={formError} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Field label={fr.createCause.fields.title} error={errors.title}>
            {(props) => (
              <Input
                {...props}
                value={title}
                maxLength={TITLE_MAX}
                placeholder={fr.createCause.fields.titlePlaceholder}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label={fr.createCause.fields.description} error={errors.description}>
            {(props) => (
              <textarea
                {...props}
                value={description}
                className={inputClass}
                placeholder={fr.createCause.fields.descriptionPlaceholder}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <Field label={fr.createCause.fields.category}>
            {(props) => (
              <NativeSelect
                {...props}
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {fr.categories[c]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Field
            label={fr.createCause.fields.banner}
            hint={fr.createCause.fields.bannerHint}
            error={errors.banner}
          >
            {(props) => (
              <Input
                {...props}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="h-auto py-2.5"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            )}
          </Field>
          {isEdit && !file && cause.bannerUrl && (
            <p className="text-xs text-muted-foreground">{fr.createCause.fields.bannerHint}</p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Field label={fr.createCause.fields.endType}>
            {(props) => (
              <NativeSelect
                {...props}
                value={endType}
                onChange={(e) => setEndType(e.target.value as EndType)}
              >
                {END_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "date"
                      ? fr.createCause.fields.endTypeDate
                      : fr.createCause.fields.endTypeGoal}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={fr.createCause.fields.goalAmount} error={errors.goalAmount}>
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={fr.createCause.fields.deadline}
            hint={fr.createCause.fields.deadlineHint(config.maxCauseDurationDays)}
            error={errors.deadline}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                min={minDate}
                max={maxDate}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="size-4"
            />
            {fr.createCause.fields.urgency}
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? router.push("/structure") : setStep((s) => s - 1))}
          disabled={submitting}
        >
          {step === 0 ? fr.common.back : fr.createCause.back}
        </Button>
        {step < 2 ? (
          <Button variant="cta" onClick={next}>
            {fr.createCause.next}
          </Button>
        ) : (
          <Button variant="cta" onClick={submit} disabled={submitting}>
            {submitting ? fr.createCause.submitting : fr.createCause.submit}
          </Button>
        )}
      </div>
    </section>
  );
}
