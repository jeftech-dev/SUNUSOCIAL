"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFileUpload } from "@/hooks/useFileUpload";
import { config } from "@/lib/config";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { PROOF_ITEM_KINDS, type ProofAutoFlag, type ProofItemKind } from "@/lib/types";

type ItemDraft = {
  key: string;
  kind: ProofItemKind;
  file: File | null;
  caption: string;
  supplier: string;
  ref: string;
};
type SpendDraft = { key: string; label: string; amount: string };

const newKey = () => Math.random().toString(36).slice(2);
const emptyItem = (): ItemDraft => ({
  key: newKey(),
  kind: "photo",
  file: null,
  caption: "",
  supplier: "",
  ref: "",
});

/** The structure's reception-dossier submission (PARCOURS S24). */
export function ProofSubmitForm({ causeId }: { causeId: Id<"causes"> }) {
  const upload = useFileUpload();
  const submit = useMutation(api.proofs.submit);
  const min = config.minProofItems;

  const [report, setReport] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(() =>
    Array.from({ length: min }, () => emptyItem()),
  );
  const [spend, setSpend] = useState<SpendDraft[]>([{ key: newKey(), label: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ flagged: ProofAutoFlag[] } | null>(null);

  const patchItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const filledItems = items.filter((it) => it.file !== null);

  const onSubmit = async () => {
    setError(null);
    if (filledItems.length < min) {
      setError(fr.errors.proofItemsTooFew(min));
      return;
    }
    if (report.trim().length < 10) {
      setError(fr.errors.proofReportTooShort);
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(
        filledItems.map(async (it) => ({
          kind: it.kind,
          fileId: await upload(it.file as File),
          caption: it.caption.trim() || undefined,
          supplier: it.supplier.trim() || undefined,
          ref: it.ref.trim() || undefined,
        })),
      );
      const spendLines = spend
        .map((s) => ({ label: s.label.trim(), amount: Number(s.amount) }))
        .filter((s) => s.label !== "" && Number.isFinite(s.amount) && s.amount > 0);

      const { autoFlagged } = await submit({
        causeId,
        report: report.trim(),
        items: uploaded,
        spend: spendLines,
      });
      setResult({ flagged: autoFlagged });
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <section className="flex flex-col items-start gap-4" aria-live="polite">
        <h1 className="font-heading text-2xl font-extrabold text-brand-blue">{fr.proof.title}</h1>
        <p className="rounded-lg bg-success-soft p-4 text-sm font-semibold text-brand-green-strong">
          {fr.proof.sent}
        </p>
        {result.flagged.length > 0 && (
          <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">
            {fr.proof.flaggedNotice(result.flagged.length)}
          </p>
        )}
        <Button variant="cta" asChild>
          <Link href="/structure">{fr.structureCauses.heading}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-extrabold text-brand-blue">{fr.proof.title}</h1>
        <p className="text-muted-foreground">{fr.proof.intro(min)}</p>
      </div>

      <FormError message={error} />

      <Field label={fr.proof.report}>
        {(props) => (
          <textarea
            {...props}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder={fr.proof.reportPlaceholder}
            className="min-h-28 w-full rounded-lg border-[1.5px] border-input bg-card p-3 text-[15px] text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive"
          />
        )}
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold">{fr.proof.items}</h2>
          <span className="text-sm text-muted-foreground">
            {fr.proof.itemCount(filledItems.length, min)}
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-3 rounded-xl border border-[var(--line-warm)] bg-card p-3"
            >
              <div className="flex flex-wrap gap-3">
                <NativeSelect
                  aria-label={fr.proof.items}
                  value={item.kind}
                  className="w-auto"
                  onChange={(e) => patchItem(item.key, { kind: e.target.value as ProofItemKind })}
                >
                  {PROOF_ITEM_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {fr.proof.itemKind[k]}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                  className="h-auto flex-1 py-2.5"
                  onChange={(e) => patchItem(item.key, { file: e.target.files?.[0] ?? null })}
                />
              </div>
              <Input
                value={item.caption}
                placeholder={fr.proof.caption}
                onChange={(e) => patchItem(item.key, { caption: e.target.value })}
              />
              {(item.kind === "invoice" || item.kind === "delivery_note") && (
                <div className="flex flex-wrap gap-3">
                  <Input
                    value={item.supplier}
                    placeholder={fr.proof.supplier}
                    className="flex-1"
                    onChange={(e) => patchItem(item.key, { supplier: e.target.value })}
                  />
                  <Input
                    value={item.ref}
                    placeholder={fr.proof.ref}
                    className="flex-1"
                    onChange={(e) => patchItem(item.key, { ref: e.target.value })}
                  />
                </div>
              )}
              {items.length > min && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-end"
                  onClick={() => setItems((list) => list.filter((it) => it.key !== item.key))}
                >
                  {fr.proof.removeItem}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setItems((list) => [...list, emptyItem()])}
        >
          {fr.proof.addItem}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-bold">{fr.proof.spend}</h2>
        <ul className="flex flex-col gap-2">
          {spend.map((line) => (
            <li key={line.key} className="flex flex-wrap gap-2">
              <Input
                value={line.label}
                placeholder={fr.proof.spendLabel}
                className="flex-1"
                onChange={(e) =>
                  setSpend((list) =>
                    list.map((s) => (s.key === line.key ? { ...s, label: e.target.value } : s)),
                  )
                }
              />
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={line.amount}
                placeholder={fr.proof.spendAmount}
                className="w-40"
                onChange={(e) =>
                  setSpend((list) =>
                    list.map((s) => (s.key === line.key ? { ...s, amount: e.target.value } : s)),
                  )
                }
              />
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setSpend((list) => [...list, { key: newKey(), label: "", amount: "" }])}
        >
          {fr.proof.addSpend}
        </Button>
      </div>

      <Button variant="cta" onClick={onSubmit} disabled={submitting} className="self-start">
        {submitting ? fr.proof.submitting : fr.proof.submit}
      </Button>
    </section>
  );
}
