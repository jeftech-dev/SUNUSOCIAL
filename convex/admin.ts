// Internal administration (DT-20). Run from the CLI by the lead developer:
//
//   npx convex run admin:createModerator '{"name": "Fatou Ndiaye", "email": "fatou@sunusocial.sn", "phone": "+221771234567"}'
//
// The moderator gets an email link to choose a password (12+ characters); the SMS code to `phone`
// is then required at every login. There is no public moderator signup.

import { v } from "convex/values";

import { fr } from "../lib/strings.fr";
import { normalizeEmail, normalizeName, normalizePhone } from "../lib/validation";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { createModeratorAccount } from "./auth";
import { appError } from "./lib/errors";
import { sendResetLink } from "./passwordReset";

export const createModerator = internalAction({
  args: { name: v.string(), email: v.string(), phone: v.string() },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> }> => {
    const name = normalizeName(args.name);
    if (!name) throw appError("VALIDATION", fr.errors.invalidName, "name");
    const email = normalizeEmail(args.email);
    if (!email) throw appError("VALIDATION", fr.errors.invalidEmail, "email");
    const phone = normalizePhone(args.phone);
    if (!phone) throw appError("VALIDATION", fr.errors.invalidPhone, "phone");
    if (await ctx.runQuery(internal.auth.accountExists, { identifier: email })) {
      throw appError("CONFLICT", fr.errors.emailTaken, "email");
    }
    const userId = await createModeratorAccount(ctx, { name, email, phone });
    await sendResetLink(ctx, { userId, role: "moderator", email, welcome: true });
    return { userId };
  },
});
