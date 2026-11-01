import type { Metadata } from "next";

import { ProofSubmitForm } from "@/components/proof/ProofSubmitForm";
import type { Id } from "@/convex/_generated/dataModel";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.proof.title} — ${fr.app.name}` };

export default async function SubmitProofPage({
  params,
}: PageProps<"/structure/preuve/[causeId]">) {
  const { causeId } = await params;
  return <ProofSubmitForm causeId={causeId as Id<"causes">} />;
}
