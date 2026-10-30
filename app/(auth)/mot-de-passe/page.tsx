import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { firstParam } from "@/lib/searchParams";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.auth.reset.title} — ${fr.app.name}` };

export default async function ResetPage({ searchParams }: PageProps<"/mot-de-passe">) {
  const params = await searchParams;
  return (
    <ResetPasswordForm initialKind={firstParam(params.role) === "org" ? "organization" : "donor"} />
  );
}
