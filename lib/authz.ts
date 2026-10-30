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

const NEXT_PATH_BASE = "http://next-path.invalid";

/**
 * A same-site path to go back to after login, or null. The value is resolved the way the browser
 * would (which drops tabs and newlines, so "/\t/evil.example" means "//evil.example") and kept
 * only if it stays on the same origin.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(next, NEXT_PATH_BASE);
  } catch {
    return null;
  }
  if (url.origin !== NEXT_PATH_BASE) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
