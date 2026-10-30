"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/useMe";
import { HOME_FOR_ROLE, safeNextPath } from "@/lib/authz";
import { signInErrorMessage } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { normalizeIdentifier } from "@/lib/validation";

import { AccountTabs, type AccountKind } from "./AccountTabs";
import { MfaStep } from "./MfaStep";

/**
 * Login (PARCOURS S03, S05). Donors: phone + password. Structures and hospitals: email + password,
 * then the SMS code. `audience="moderation"` is the moderator login on the moderation subdomain.
 */
export function LoginForm({
  audience = "app",
  initialKind = "donor",
  next,
}: {
  audience?: "app" | "moderation";
  initialKind?: AccountKind;
  next?: string | null;
}) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const me = useMe();
  const [kind, setKind] = useState<AccountKind>(
    audience === "moderation" ? "organization" : initialKind,
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Signed in and verified: go to the requested page or the role's home.
  useEffect(() => {
    if (me && me.mfaVerified) {
      router.replace(safeNextPath(next) ?? HOME_FOR_ROLE[me.user.role]);
    }
  }, [me, next, router]);

  if (me && !me.mfaVerified) return <MfaStep />;
  if (me) return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>;

  const isDonor = kind === "donor";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeIdentifier(identifier);
    if (!normalized || password.length === 0) {
      setError(fr.errors.invalidCredentials);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signIn("password", {
        flow: "signIn",
        identifier: normalized,
        password,
        ...(audience === "moderation" ? { audience: "moderation" } : {}),
      });
      // `me` updates once the session is active; the effect above takes over.
    } catch (e) {
      setError(signInErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  const title =
    audience === "moderation"
      ? fr.moderation.loginTitle
      : isDonor
        ? fr.auth.login.donorTitle
        : fr.auth.login.orgTitle;
  const intro =
    audience === "moderation"
      ? fr.moderation.loginIntro
      : isDonor
        ? fr.auth.login.donorIntro
        : fr.auth.login.orgIntro;

  return (
    <div className="flex flex-col gap-6">
      {audience === "app" && <AccountTabs value={kind} onChange={setKind} />}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand-blue">{title}</h1>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        {isDonor ? (
          <Field label={fr.auth.fields.phone}>
            {(props) => (
              <Input
                {...props}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={fr.auth.fields.phonePlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            )}
          </Field>
        ) : (
          <Field label={audience === "moderation" ? fr.moderation.email : fr.auth.fields.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            )}
          </Field>
        )}
        <Field label={fr.auth.fields.password}>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Link href="/mot-de-passe" className="self-start text-sm font-semibold">
          {fr.nav.forgotPassword}
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? fr.common.loading : fr.auth.login.submit}
        </Button>
      </form>
      {audience === "app" ? (
        <p className="text-sm text-muted-foreground">
          {fr.auth.login.noAccount}{" "}
          <Link href={isDonor ? "/inscription" : "/inscription?role=org"} className="font-semibold">
            {fr.auth.login.createAccount}
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{fr.moderation.footer}</p>
      )}
    </div>
  );
}
