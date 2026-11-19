import type { Metadata } from "next";

import { PaymentSimulator } from "@/components/cause/PaymentSimulator";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.simulator.title} — ${fr.app.name}` };

export default async function PaymentSimulatorPage({
  params,
}: PageProps<"/paiement/simulation/[donationId]">) {
  const { donationId } = await params;
  return <PaymentSimulator id={donationId} />;
}
