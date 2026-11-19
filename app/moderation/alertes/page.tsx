import { RequireRole } from "@/components/auth/RequireRole";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AlertsOversight } from "@/components/moderation/AlertsOversight";

/** Mod: oversight of every blood alert (DT-26). */
export default function ModerationAlertsPage() {
  return (
    <RequireRole role="moderator" loginPath="/">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <SignOutButton />
        </div>
        <AlertsOversight />
      </div>
    </RequireRole>
  );
}
