"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useMe } from "@/hooks/useMe";
import { HOME_FOR_ROLE } from "@/lib/authz";
import { fr } from "@/lib/strings.fr";
import type { Role } from "@/lib/types";

import { MfaStep } from "./MfaStep";

/**
 * Client guard for a role's space: sends visitors to the login page, asks for the SMS code when
 * the session still needs it, and sends other roles to their own space.
 * The server enforces the same rules on every function; this only steers navigation.
 */
export function RequireRole({
  role,
  loginPath = "/connexion",
  children,
}: {
  role: Role;
  loginPath?: string;
  children: ReactNode;
}) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (me === null) {
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
    } else if (me && me.user.role !== role && me.user.role !== "moderator") {
      router.replace(HOME_FOR_ROLE[me.user.role]);
    }
  }, [me, role, loginPath, pathname, router]);

  if (me === undefined || me === null) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{fr.common.loading}</p>;
  }
  if (me.user.role !== role) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{fr.errors.forbidden}</p>;
  }
  if (!me.mfaVerified) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <MfaStep />
      </div>
    );
  }
  return children;
}
