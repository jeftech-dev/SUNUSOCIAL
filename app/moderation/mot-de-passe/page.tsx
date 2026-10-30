import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ModerationResetPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-5 shadow-sm sm:p-8">
      <ResetPasswordForm initialKind="organization" showTabs={false} />
    </div>
  );
}
