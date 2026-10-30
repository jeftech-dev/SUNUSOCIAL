import { RequireRole } from "@/components/auth/RequireRole";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { fr } from "@/lib/strings.fr";

/** Mod 02 queues: placeholder until Sprint 5. */
export default function ModerationQueuesPage() {
  return (
    <RequireRole role="moderator" loginPath="/">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-brand-blue">{fr.moderation.queuesTitle}</h1>
          <SignOutButton />
        </div>
        <p className="text-muted-foreground">{fr.moderation.queuesSoon}</p>
      </section>
    </RequireRole>
  );
}
