// Server-side authorisation helpers, used at the top of every public function (SECURITY.md §2).
// Role, MFA state and ownership come from the database, never from client input.

import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";

import { fr } from "../../lib/strings.fr";
import type { Role } from "../../lib/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "./errors";

export interface AuthedUser {
  user: Doc<"users">;
  session: Doc<"authSessions">;
}

/** Roles that must pass the SMS code on every login (DT-2). */
const MFA_ROLES: ReadonlySet<Role> = new Set(["structure", "hospital", "moderator"]);

/** The signed-in, enabled user and their session; throws otherwise. Does not check MFA. */
export async function requireUser(ctx: QueryCtx): Promise<AuthedUser> {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!userId || !sessionId) throw appError("UNAUTHENTICATED", fr.errors.notAuthenticated);
  const [user, session] = await Promise.all([ctx.db.get(userId), ctx.db.get(sessionId)]);
  if (!user || !session) throw appError("UNAUTHENTICATED", fr.errors.notAuthenticated);
  if (user.disabled) throw appError("FORBIDDEN", fr.errors.accountDisabled);
  return { user, session };
}

/**
 * Requires one of `roles`. Structures, hospitals and moderators must also have verified the SMS
 * code for this session. Sessions themselves expire after SESSION_TOTAL_DAYS (Convex Auth).
 */
export async function requireRole(ctx: QueryCtx, ...roles: Role[]): Promise<AuthedUser> {
  const authed = await requireUser(ctx);
  if (!roles.includes(authed.user.role)) throw appError("FORBIDDEN", fr.errors.forbidden);
  if (MFA_ROLES.has(authed.user.role) && authed.session.mfaVerifiedAt === undefined) {
    throw appError("MFA_REQUIRED", fr.errors.mfaRequired);
  }
  return authed;
}

/** Requires a structure or hospital account that owns `structureId`. */
export async function requireOwner(
  ctx: QueryCtx,
  structureId: Id<"structures">,
): Promise<AuthedUser> {
  const authed = await requireRole(ctx, "structure", "hospital");
  if (authed.user.structureId !== structureId) throw appError("FORBIDDEN", fr.errors.forbidden);
  return authed;
}
