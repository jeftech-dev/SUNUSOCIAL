import type { Metadata } from "next";

import { CauseWizard } from "@/components/structure/CauseWizard";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.createCause.title} — ${fr.app.name}` };

export default function NewCausePage() {
  return <CauseWizard />;
}
