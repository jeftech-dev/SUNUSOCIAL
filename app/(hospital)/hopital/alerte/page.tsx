import type { Metadata } from "next";

import { AlertComposer } from "@/components/blood/AlertComposer";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.blood.composer.title} — ${fr.app.name}` };

/** 10 Émettre une alerte (PARCOURS S28). */
export default function NewAlertPage() {
  return <AlertComposer />;
}
