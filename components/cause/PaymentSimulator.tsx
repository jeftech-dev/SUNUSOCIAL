"use client";

import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError } from "@/components/forms/Field";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { toUiError } from "@/lib/errors";
import { formatFCFA } from "@/lib/money";
import { fr } from "@/lib/strings.fr";

/**
 * Mock checkout page (PAYMENT_PROVIDER=mock). It stands in for NabooPay's hosted page in
 * development and preview; "Payer" drives the real webhook path server-side.
 */
export function PaymentSimulator({ id }: { id: string }) {
  const donation = useQuery(api.donations.status, { donationId: id });
  const simulate = useAction(api.payments.simulatePayment);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(outcome: "paid" | "cancelled") {
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await simulate({ donationId: id, outcome });
      router.push(redirectTo);
    } catch (e) {
      setError(toUiError(e).message);
      setBusy(false);
    }
  }

  if (donation === undefined) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>;
  }

  const payable = donation !== null && donation.status === "pending";

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border border-dashed border-brand-orange bg-card p-6">
      <span className="self-start rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-wide text-brand-orange-strong">
        {fr.simulator.badge}
      </span>
      <h1 className="font-heading text-xl font-extrabold text-brand-blue">{fr.simulator.title}</h1>
      <p className="text-sm text-muted-foreground">{fr.simulator.intro}</p>

      {payable ? (
        <>
          <div className="rounded-lg bg-primary-soft p-4 text-center">
            <strong className="font-heading text-2xl">
              {fr.simulator.summary(formatFCFA(donation.amount), fr.methods[donation.method])}
            </strong>
          </div>
          <FormError message={error} />
          <div className="flex flex-col gap-2">
            <Button variant="cta" size="lg" disabled={busy} onClick={() => run("paid")}>
              {fr.simulator.pay}
            </Button>
            <Button variant="outline" size="lg" disabled={busy} onClick={() => run("cancelled")}>
              {fr.simulator.cancel}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">{fr.simulator.notPending}</p>
          <Link
            href={donation ? `/dons/${donation.id}` : "/causes"}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {donation ? fr.simulator.seeDonation : fr.donationResult.browse}
          </Link>
        </>
      )}
    </section>
  );
}
