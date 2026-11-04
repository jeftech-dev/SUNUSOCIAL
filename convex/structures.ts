// Structure self-service: changing the payout account (DB-15, DT-5). A change needs an SMS code on
// the NEW number and a moderator re-approval; payouts are blocked while the change is pending
// (`structures.payoutPending`), and every change is audit-logged.

import { v } from "convex/values";

import { normalizeName, normalizePhone } from "../lib/validation";
import { fr } from "../lib/strings.fr";
import { mutation } from "./_generated/server";
import { logAudit } from "./audit";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { checkOtp, otpErrorMessage } from "./otp";
import { methodV } from "./validators";

/**
 * Requests a payout-account change (S10). The new number must already have passed a `payout_number`
 * SMS code (via `otp.send`); the change lands in `payoutPending` and blocks payouts until a moderator
 * approves it in `moderation.decidePayoutAccount` (DT-5).
 */
export const requestPayoutChange = mutation({
  args: {
    payout: v.object({
      method: methodV,
      accountNumber: v.string(),
      holderName: v.string(),
      otpCode: v.string(),
    }),
  },
  handler: async (ctx, { payout }): Promise<{ ok: true }> => {
    const { user } = await requireRole(ctx, "structure");
    if (!user.structureId) throw appError("FORBIDDEN", fr.errors.forbidden);
    const structure = await ctx.db.get(user.structureId);
    if (!structure) throw appError("NOT_FOUND", fr.errors.generic);
    // One pending change at a time (DT-5): a second request would silently drop the first (and its
    // SMS-verified account) and leave the moderation queue showing a change the structure replaced.
    if (structure.payoutPending) {
      throw appError("CONFLICT", fr.errors.payoutChangeAlreadyPending);
    }

    const accountNumber = normalizePhone(payout.accountNumber);
    if (!accountNumber) throw appError("VALIDATION", fr.errors.invalidPhone, "payout.accountNumber");
    const holderName = normalizeName(payout.holderName);
    if (!holderName) throw appError("VALIDATION", fr.errors.invalidName, "payout.holderName");

    // Prove control of the NEW number (DT-5): a wrong number would send money to a stranger.
    const check = await checkOtp(ctx, {
      purpose: "payout_number",
      phone: accountNumber,
      code: payout.otpCode.trim(),
    });
    if (!check.ok) throw appError("OTP_INVALID", otpErrorMessage(check), "payout.otpCode");

    await ctx.db.patch(user.structureId, {
      payoutPending: {
        method: payout.method,
        accountNumber,
        holderName,
        phoneVerifiedAt: Date.now(),
      },
      payoutPendingAt: Date.now(),
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "payout.change_request",
      targetTable: "structures",
      targetId: user.structureId,
      details: { method: payout.method },
    });
    return { ok: true };
  },
});
