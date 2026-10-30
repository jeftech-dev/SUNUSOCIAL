import type { Metadata } from "next";

import { CauseDetail } from "@/components/cause/CauseDetail";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.spaces.donorTitle} — ${fr.app.name}` };

export default async function CausePage({ params }: PageProps<"/causes/[id]">) {
  const { id } = await params;
  return <CauseDetail id={id} />;
}
