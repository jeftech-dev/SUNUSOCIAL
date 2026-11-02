import { RequireRole } from "@/components/auth/RequireRole";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ModerationQueues } from "@/components/moderation/ModerationQueues";

/** Mod 02: the structures / causes / proofs moderation queues. */
export default function ModerationQueuesPage() {
  return (
    <RequireRole role="moderator" loginPath="/">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <SignOutButton />
        </div>
        <ModerationQueues />
      </div>
    </RequireRole>
  );
}
