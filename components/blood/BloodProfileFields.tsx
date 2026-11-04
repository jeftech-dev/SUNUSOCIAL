"use client";

import { Field } from "@/components/forms/Field";
import { NativeSelect } from "@/components/ui/select";
import { communesOf, REGIONS } from "@/lib/geo";
import { fr } from "@/lib/strings.fr";
import { BLOOD_TYPES, type BloodType } from "@/lib/types";

export interface BloodProfileValue {
  optIn: boolean;
  bloodType: BloodType;
  region: string;
  commune: string;
  smsOptIn: boolean;
}

export const DEFAULT_BLOOD_PROFILE: BloodProfileValue = {
  optIn: false,
  bloodType: "unknown",
  region: REGIONS[0],
  commune: communesOf(REGIONS[0])[0],
  smsOptIn: true,
};

/** The donor's blood opt-in (group, commune, SMS), shared by signup and the /sang profile card. */
export function BloodProfileFields({
  value,
  onChange,
  communeError,
}: {
  value: BloodProfileValue;
  onChange: (next: BloodProfileValue) => void;
  communeError?: string;
}) {
  const set = (patch: Partial<BloodProfileValue>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <legend className="px-1 text-sm font-semibold">{fr.auth.blood.title}</legend>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5 accent-[var(--brand-blue)]"
          checked={value.optIn}
          onChange={(e) => set({ optIn: e.target.checked })}
        />
        <span>
          <span className="font-semibold">{fr.auth.blood.optIn}</span>
          <span className="block text-muted-foreground">{fr.auth.blood.hint}</span>
        </span>
      </label>
      {value.optIn && (
        <>
          <Field label={fr.auth.blood.bloodType}>
            {(props) => (
              <NativeSelect
                {...props}
                value={value.bloodType}
                onChange={(e) => set({ bloodType: e.target.value as BloodType })}
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
                  value={value.region}
                  onChange={(e) =>
                    set({ region: e.target.value, commune: communesOf(e.target.value)[0] })
                  }
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={fr.foundations.commune} error={communeError}>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={value.commune}
                  onChange={(e) => set({ commune: e.target.value })}
                >
                  {communesOf(value.region).map((c) => (
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
              checked={value.smsOptIn}
              onChange={(e) => set({ smsOptIn: e.target.checked })}
            />
            {fr.auth.blood.sms}
          </label>
        </>
      )}
    </fieldset>
  );
}
