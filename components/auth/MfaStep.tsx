"use client";

import { useAction, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { FormError } from "@/components/forms/Field";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { fr } from "@/lib/strings.fr";

import { OtpStep } from "./OtpStep";

/** Second login step for structures, hospitals and moderators (DT-2). Sends the code on mount. */
export function MfaStep({ onDone }: { onDone?: () => void }) {
  const send = useAction(api.otp.send);
  const verify = useMutation(api.otp.verifyLogin);
  const [to, setTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    send({ purpose: "login_2fa" })
      .then((r) => setTo(r.to))
      .catch((e: unknown) => {
        setError(toUiError(e).message);
        setTo("•••");
      });
  }, [send]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-brand-blue">{fr.auth.otp.mfaTitle}</h1>
        <p className="text-sm text-muted-foreground">{fr.auth.otp.mfaIntro}</p>
      </div>
      <FormError message={error} />
      {to === null ? (
        <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
      ) : (
        <OtpStep
          to={to}
          submitLabel={fr.auth.otp.validate}
          onSubmit={async (code) => {
            const result = await verify({ code });
            if (!result.ok) return result.error.message;
            onDone?.();
            return null;
          }}
          onResend={async () => {
            const r = await send({ purpose: "login_2fa" });
            setTo(r.to);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
