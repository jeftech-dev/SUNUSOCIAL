"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { fr } from "@/lib/strings.fr";

export function SignOutButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await signOut();
        router.replace(redirectTo);
      }}
    >
      {fr.auth.logout}
    </Button>
  );
}
