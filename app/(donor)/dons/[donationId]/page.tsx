import type { Metadata } from "next";

import { DonationResult } from "@/components/cause/DonationResult";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.donationResult.title} — ${fr.app.name}` };

export default async function DonationResultPage({ params }: PageProps<"/dons/[donationId]">) {
  const { donationId } = await params;
  return <DonationResult id={donationId} />;
}
