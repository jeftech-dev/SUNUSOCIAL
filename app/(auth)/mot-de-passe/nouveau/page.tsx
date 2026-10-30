import type { Metadata } from "next";

import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { firstParam } from "@/lib/searchParams";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = {
  title: `${fr.auth.reset.newTitle} — ${fr.app.name}`,
  // The token is in the URL: never let it leak through the Referer header.
  referrer: "no-referrer",
};

export default async function NewPasswordPage({
  searchParams,
}: PageProps<"/mot-de-passe/nouveau">) {
  const params = await searchParams;
  return <NewPasswordForm token={firstParam(params.token) ?? ""} loginPath="/connexion?role=org" />;
}
