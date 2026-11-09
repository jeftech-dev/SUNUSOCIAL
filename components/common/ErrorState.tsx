"use client";

import { Button } from "@/components/ui/button";
import { fr } from "@/lib/strings.fr";

/** Route error boundary body: neutral message plus a retry (no stack or error text is shown). */
export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-xl bg-muted p-6">
      <h1 className="font-heading text-2xl font-extrabold text-brand-blue">
        {fr.states.errorTitle}
      </h1>
      <p className="text-muted-foreground">{fr.states.errorBody}</p>
      <Button onClick={reset}>{fr.states.retry}</Button>
    </div>
  );
}
