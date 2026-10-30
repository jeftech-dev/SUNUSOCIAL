// Append-only activity / audit log (DB-9, DT-18). Rows are never edited or deleted, except the
// 12-month purge of donor login events.

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export interface AuditEntry {
  /** Absent for system jobs (cron, webhook). */
  actorId?: Id<"users">;
  action: string;
  targetTable: string;
  targetId: string;
  details?: Record<string, unknown>;
}

export async function logAudit(ctx: MutationCtx, entry: AuditEntry): Promise<void> {
  await ctx.db.insert("auditLog", { ...entry, createdAt: Date.now() });
}
