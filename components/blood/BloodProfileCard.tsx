"use client";

import { useMutation } from "convex/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useMe } from "@/hooks/useMe";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";

import {
  BloodProfileFields,
  DEFAULT_BLOOD_PROFILE,
  type BloodProfileValue,
} from "./BloodProfileFields";
import { NoticeBanner, type Notice } from "./BloodShared";

/** "Mon profil donneur": view and edit the blood opt-in (health data, visible to the donor only). */
export function BloodProfileCard() {
  const me = useMe();
  const update = useMutation(api.auth.updateBloodProfile);
  const [draft, setDraft] = useState<BloodProfileValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  if (!me || me.user.role !== "donor") return null;
  const profile = me.profile;
  const current: BloodProfileValue = profile
    ? {
        optIn: profile.bloodOptIn,
        bloodType: profile.bloodType ?? "unknown",
        region: profile.region ?? DEFAULT_BLOOD_PROFILE.region,
        commune: profile.commune ?? DEFAULT_BLOOD_PROFILE.commune,
        smsOptIn: profile.smsOptIn,
      }
    : DEFAULT_BLOOD_PROFILE;

  async function save() {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      await update({
        optIn: draft.optIn,
        bloodType: draft.optIn ? draft.bloodType : undefined,
        region: draft.region,
        commune: draft.commune,
        smsOptIn: draft.optIn && draft.smsOptIn,
      });
      setDraft(null);
      setNotice({ kind: "success", text: fr.blood.donor.saved });
    } catch (error) {
      setNotice({ kind: "error", text: toUiError(error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="blood-profile"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span id="blood-profile" className="text-xs font-bold uppercase text-muted-foreground">
            {fr.blood.donor.profileTitle}
          </span>
          <strong className="font-heading text-lg text-brand-blue">
            {current.optIn
              ? fr.blood.donor.profileGroup(fr.bloodTypes[current.bloodType])
              : fr.blood.donor.profileNotSet}
          </strong>
          {current.optIn && (
            <span className="text-sm text-muted-foreground">
              {current.commune}, {current.region}
            </span>
          )}
        </div>
        {!draft && (
          <Button variant="outline" size="sm" onClick={() => setDraft(current)}>
            {current.optIn ? fr.blood.donor.edit : fr.blood.donor.optInCta}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{fr.blood.donor.privacy}</p>
      <NoticeBanner notice={notice} />
      {draft && (
        <>
          <BloodProfileFields value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              {fr.blood.donor.cancel}
            </Button>
            <Button variant="cta" size="sm" disabled={saving} onClick={save}>
              {saving ? fr.common.loading : fr.blood.donor.save}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
