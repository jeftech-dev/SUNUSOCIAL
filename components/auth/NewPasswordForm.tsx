"use client";

import { useAction } from "convex/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";
import { isValidPassword, PASSWORD_MIN_LENGTH } from "@/lib/validation";

/** New password from an emailed link (organisations and moderators, DT-15). */
export function NewPasswordForm({ token, loginPath }: { token: string; loginPath: string }) {
  const reset = useAction(api.passwordReset.resetWithToken);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidPassword(password, "organization")) {
      setError(fr.errors.passwordTooShort(PASSWORD_MIN_LENGTH.organization));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await reset({ token, newPassword: password });
      setDone(true);
    } catch (e) {
      setError(toUiError(e).message);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="text-muted-foreground">{fr.auth.reset.doneOrg}</p>
        <Button asChild size="lg">
          <Link href={loginPath}>{fr.auth.login.submit}</Link>
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-2xl font-bold text-brand-blue">{fr.auth.reset.newTitle}</h1>
      <FormError message={token ? error : fr.errors.resetLinkInvalid} />
      <Field label={fr.auth.fields.newPassword} hint={fr.auth.signup.orgPasswordHint}>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="cta" size="lg" disabled={pending || !token}>
        {pending ? fr.common.loading : fr.auth.reset.submitDonor}
      </Button>
    </form>
  );
}
