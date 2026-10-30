import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";
import { firstParam } from "@/lib/searchParams";
import { fr } from "@/lib/strings.fr";

export const metadata: Metadata = { title: `${fr.auth.login.submit} — ${fr.app.name}` };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  return (
    <LoginForm
      initialKind={firstParam(params.role) === "org" ? "organization" : "donor"}
      next={firstParam(params.next) ?? null}
    />
  );
}
