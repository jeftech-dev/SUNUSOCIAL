import type { Metadata } from "next";

import { EditCause } from "@/components/structure/EditCause";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.createCause.title} — ${fr.app.name}` };

export default async function EditCausePage({
  params,
}: PageProps<"/structure/causes/[id]/modifier">) {
  const { id } = await params;
  return <EditCause id={id} />;
}
