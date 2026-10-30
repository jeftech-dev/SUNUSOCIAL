// Client-side route helpers. They only steer navigation: every Convex function re-checks the
// role, MFA state and ownership on the server (convex/lib/guards.ts).

import type { Role } from "./types";

/** Where each role lands after signing in. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  donor: "/causes",
  structure: "/structure",
  hospital: "/hopital",
  moderator: "/file",
};

/** Path prefixes of the main app that need a session (the moderation app is guarded separately). */
export const PROTECTED_PREFIXES = ["/causes", "/profil", "/sang", "/structure", "/hopital"];

/** Hosts of the moderation subdomain: `moderation.<domain>`, and `moderation.localhost` in dev. */
export function isModerationHost(host: string | null | undefined): boolean {
  return (host ?? "").toLowerCase().startsWith("moderation.");
}

/** A same-site path to go back to after login, or null. Refuses absolute and protocol-relative URLs. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}
