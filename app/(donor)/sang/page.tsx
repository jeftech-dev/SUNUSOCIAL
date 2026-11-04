import type { Metadata } from "next";

import { BeforeYouCome } from "@/components/blood/BeforeYouCome";
import { BloodMessages } from "@/components/blood/BloodMessages";
import { BloodProfileCard } from "@/components/blood/BloodProfileCard";
import { DonorAlertList } from "@/components/blood/DonorAlertList";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.blood.donor.title} — ${fr.app.name}` };

/** 07 Don de sang (PARCOURS S26–S29). */
export default function BloodPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-extrabold text-brand-blue">
          {fr.blood.donor.title}
        </h1>
        <p className="text-muted-foreground">{fr.blood.donor.intro}</p>
      </header>
      <BloodProfileCard />
      <DonorAlertList />
      <BloodMessages />
      <BeforeYouCome />
      <section className="flex flex-col gap-2 rounded-xl bg-brand-blue p-4 text-white">
        <span className="text-xs font-bold uppercase opacity-80">
          {fr.blood.donor.exampleTitle}
        </span>
        <p className="text-sm">{fr.blood.donor.exampleSms}</p>
        <p className="text-xs opacity-80">{fr.blood.donor.exampleNote}</p>
      </section>
    </div>
  );
}
