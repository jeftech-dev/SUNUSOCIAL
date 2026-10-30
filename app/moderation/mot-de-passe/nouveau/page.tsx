import type { Metadata } from "next";

import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { firstParam } from "@/lib/searchParams";

export const metadata: Metadata = { referrer: "no-referrer" };

export default async function ModerationNewPasswordPage({
  searchParams,
}: PageProps<"/moderation/mot-de-passe/nouveau">) {
  const params = await searchParams;
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-5 shadow-sm sm:p-8">
      <NewPasswordForm token={firstParam(params.token) ?? ""} loginPath="/" />
    </div>
  );
}
