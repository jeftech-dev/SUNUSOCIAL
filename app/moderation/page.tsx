import { LoginForm } from "@/components/auth/LoginForm";
import { firstParam } from "@/lib/searchParams";

/** Moderator login (Mod 01): email + password + SMS code, no role selector (DT-9, DT-20). */
export default async function ModerationLoginPage({ searchParams }: PageProps<"/moderation">) {
  const params = await searchParams;
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-5 shadow-sm sm:p-8">
      <LoginForm audience="moderation" next={firstParam(params.next) ?? null} />
    </div>
  );
}
