"use client";

import Link from "next/link";
import { useState } from "react";

import { fr } from "@/lib/strings.fr";

import { AccountTabs, type AccountKind } from "./AccountTabs";
import { DonorSignupForm } from "./DonorSignupForm";
import { OrganizationSignupForm } from "./OrganizationSignupForm";

export function SignupPanel({ initialKind }: { initialKind: AccountKind }) {
  const [kind, setKind] = useState<AccountKind>(initialKind);
  const isDonor = kind === "donor";
  return (
    <div className="flex flex-col gap-6">
      <AccountTabs value={kind} onChange={setKind} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand-blue">
          {isDonor ? fr.auth.signup.donorTitle : fr.auth.signup.orgTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDonor ? fr.auth.signup.donorIntro : fr.auth.signup.orgIntro}
        </p>
      </div>
      {isDonor ? <DonorSignupForm /> : <OrganizationSignupForm />}
      <p className="text-sm text-muted-foreground">
        {fr.auth.signup.hasAccount}{" "}
        <Link href={isDonor ? "/connexion" : "/connexion?role=org"} className="font-semibold">
          {fr.auth.login.submit}
        </Link>
      </p>
    </div>
  );
}
