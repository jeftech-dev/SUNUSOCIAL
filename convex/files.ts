// File uploads (convex-file-storage). Signup documents are uploaded before the account exists, so
// the upload URL is public and rate-limited globally; registerOrganization checks type and size.

import { mutation } from "./_generated/server";
import { fr } from "../lib/strings.fr";
import { appError } from "./lib/errors";
import { hitRateLimit } from "./lib/rateLimit";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const limit = await hitRateLimit(ctx, "upload:signup", { max: 60, windowMs: 10 * 60 * 1000 });
    if (!limit.ok) throw appError("RATE_LIMITED", fr.errors.rateLimited);
    return await ctx.storage.generateUploadUrl();
  },
});
