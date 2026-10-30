import type { Metadata } from "next";

import { SignupPanel } from "@/components/auth/SignupPanel";
import { firstParam } from "@/lib/searchParams";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.nav.signup} — ${fr.app.name}` };

export default async function SignupPage({ searchParams }: PageProps<"/inscription">) {
  const params = await searchParams;
  return <SignupPanel initialKind={firstParam(params.role) === "org" ? "organization" : "donor"} />;
}
