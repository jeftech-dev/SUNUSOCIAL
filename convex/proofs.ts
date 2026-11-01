// Reception dossiers (PARCOURS S24, DT-13). A structure submits ≥ MIN_PROOF_ITEMS files, a written
// report and a spend breakdown once its cause is funded. Logic auto-flags (reused invoice reference,
// spend vs. net received) run here synchronously; the image checks (EXIF date, duplicate file) run in
// the scheduled `proofChecks.run` action. Flags are advisory — the moderator decides (DT-13).

import { v } from "convex/values";

import { getAuthUserId } from "@convex-dev/auth/server";

import { loadConfig } from "../lib/config";
import { formatFCFA } from "../lib/money";
import { fr } from "../lib/strings.fr";
import type {
  ProofAutoFlag,
  ProofDossierView,
  ProofFeedCard,
  ProofItemView,
} from "../lib/types";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { validateUpload, type UploadFamily } from "./files";
import { appError } from "./lib/errors";
import { requireOwner } from "./lib/guards";
import { proofItemKindV, spendLineV } from "./validators";

const REPORT_MIN = 10;
/** Spend total may differ from the net received by at most this share before it is flagged (DT-13). */
const SPEND_TOLERANCE = 0.05;

/** The upload families allowed for each item kind (DT-12). */
const FAMILY_BY_KIND: Record<Doc<"proofItems">["kind"], readonly UploadFamily[]> = {
  photo: ["image"],
  video: ["video"],
  invoice: ["pdf", "image"],
  delivery_note: ["pdf", "image"],
};

/** The signed-in user, or null (used by the public-facing dossier reads). */
async function viewerOf(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get(userId) : null;
}

/** Net FCFA actually received for a cause (held or released donations). */
async function netReceived(ctx: QueryCtx, causeId: Id<"causes">): Promise<number> {
  const donations = await ctx.db
    .query("donations")
    .withIndex("by_cause", (q) => q.eq("causeId", causeId))
    .collect();
  return donations
    .filter((d) => d.status === "held" || d.status === "released")
    .reduce((sum, d) => sum + d.net, 0);
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export const submit = mutation({
  args: {
    causeId: v.id("causes"),
    report: v.string(),
    items: v.array(
      v.object({
        kind: proofItemKindV,
        fileId: v.id("_storage"),
        caption: v.optional(v.string()),
        supplier: v.optional(v.string()),
        ref: v.optional(v.string()),
        lines: v.optional(v.array(spendLineV)),
        durationSec: v.optional(v.number()),
      }),
    ),
    spend: v.array(spendLineV),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    proofId: Id<"proofs">;
    status: "submitted";
    itemCount: number;
    autoFlagged: ProofAutoFlag[];
  }> => {
    const cause = await ctx.db.get(args.causeId);
    if (!cause) throw appError("NOT_FOUND", fr.errors.causeNotFound, "causeId");
    const { user } = await requireOwner(ctx, cause.structureId);

    // A proof is only due once funds have reached the structure (release or deletion payout, DB-12).
    const deadline = await ctx.db
      .query("proofDeadlines")
      .withIndex("by_cause", (q) => q.eq("causeId", args.causeId))
      .unique();
    if (!deadline && cause.fundsReleasedAt === undefined) {
      throw appError("CONFLICT", fr.errors.proofNotDue, "causeId");
    }

    const existing = await ctx.db
      .query("proofs")
      .withIndex("by_cause", (q) => q.eq("causeId", args.causeId))
      .unique();
    if (existing) throw appError("CONFLICT", fr.errors.proofAlreadySubmitted, "causeId");

    const { minProofItems } = loadConfig(process.env);
    if (args.items.length < minProofItems) {
      throw appError("VALIDATION", fr.errors.proofItemsTooFew(minProofItems), "items");
    }
    if (args.report.trim().length < REPORT_MIN) {
      throw appError("VALIDATION", fr.errors.proofReportTooShort, "report");
    }
    for (const item of args.items) {
      await validateUpload(ctx, item.fileId, FAMILY_BY_KIND[item.kind], "items");
    }

    const now = Date.now();
    const proofId = await ctx.db.insert("proofs", {
      causeId: args.causeId,
      structureId: cause.structureId,
      report: args.report.trim(),
      spend: args.spend,
      status: "submitted",
      dossierFlags: [],
      createdAt: now,
    });

    const itemIds: Id<"proofItems">[] = [];
    for (const item of args.items) {
      itemIds.push(
        await ctx.db.insert("proofItems", {
          proofId,
          kind: item.kind,
          fileId: item.fileId,
          caption: item.caption,
          supplier: item.supplier,
          ref: item.ref,
          lines: item.lines,
          durationSec: item.durationSec,
          flagged: false,
        }),
      );
    }

    // --- Logic auto-flags (synchronous): reused invoice reference + spend vs. net received. ---
    const autoFlagged: ProofAutoFlag[] = [];
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      if ((item.kind !== "invoice" && item.kind !== "delivery_note") || !item.supplier || !item.ref) {
        continue;
      }
      const matches = await ctx.db
        .query("proofItems")
        .withIndex("by_supplier_ref", (q) => q.eq("supplier", item.supplier!).eq("ref", item.ref!))
        .collect();
      if (matches.some((m) => m.proofId !== proofId)) {
        await ctx.db.patch(itemIds[i], { flagged: true, flagReason: fr.proofFlags.invoiceReused });
        autoFlagged.push({ index: i, reason: fr.proofFlags.invoiceReused });
      }
    }

    const net = await netReceived(ctx, args.causeId);
    const spendTotal = args.spend.reduce((sum, line) => sum + line.amount, 0);
    const dossierFlags: string[] = [];
    if (net > 0 && Math.abs(spendTotal - net) / net > SPEND_TOLERANCE) {
      dossierFlags.push(fr.proofFlags.spendMismatch(formatFCFA(spendTotal), formatFCFA(net)));
    }
    if (dossierFlags.length > 0) await ctx.db.patch(proofId, { dossierFlags });

    await logAudit(ctx, {
      actorId: user._id,
      action: "proof.submit",
      targetTable: "proofs",
      targetId: proofId,
      details: { itemCount: args.items.length, autoFlagged: autoFlagged.length },
    });

    // Image checks (EXIF date, duplicate file) run out of band and may add flags afterwards.
    await ctx.scheduler.runAfter(0, internal.proofChecks.run, { proofId });

    return { proofId, status: "submitted", itemCount: args.items.length, autoFlagged };
  },
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function toItemViews(
  ctx: QueryCtx,
  proofId: Id<"proofs">,
  includeFlags: boolean,
): Promise<ProofItemView[]> {
  const items = await ctx.db
    .query("proofItems")
    .withIndex("by_proof", (q) => q.eq("proofId", proofId))
    .collect();
  return Promise.all(
    items.map(async (item) => ({
      id: item._id,
      kind: item.kind,
      url: await ctx.storage.getUrl(item.fileId),
      caption: item.caption ?? null,
      supplier: item.supplier ?? null,
      ref: item.ref ?? null,
      flagged: includeFlags ? item.flagged : false,
      flagReason: includeFlags ? (item.flagReason ?? null) : null,
    })),
  );
}

/**
 * One dossier. The owning structure and moderators see it at any status (with flags); everyone else
 * only once it is `validated`, and without the moderation flags.
 */
export const get = query({
  args: { proofId: v.id("proofs") },
  handler: async (ctx, { proofId }): Promise<ProofDossierView | null> => {
    const proof = await ctx.db.get(proofId);
    if (!proof) return null;
    const viewer = await viewerOf(ctx);
    const isOwner =
      viewer !== null &&
      (viewer.role === "structure" || viewer.role === "hospital") &&
      viewer.structureId === proof.structureId;
    const isModerator = viewer?.role === "moderator";
    const privileged = isOwner || isModerator;
    if (proof.status !== "validated" && !privileged) return null;

    const [cause, structure] = await Promise.all([
      ctx.db.get(proof.causeId),
      ctx.db.get(proof.structureId),
    ]);
    return {
      proofId: proof._id,
      causeId: proof.causeId,
      causeTitle: cause?.title ?? "",
      organization: structure?.name ?? "",
      report: proof.report,
      spend: proof.spend,
      status: proof.status,
      dossierFlags: privileged ? proof.dossierFlags : [],
      items: await toItemViews(ctx, proof._id, privileged),
      validatedAt: proof.validatedAt ?? null,
    };
  },
});

async function toFeedCard(ctx: QueryCtx, proof: Doc<"proofs">): Promise<ProofFeedCard> {
  const [cause, structure, firstItem] = await Promise.all([
    ctx.db.get(proof.causeId),
    ctx.db.get(proof.structureId),
    ctx.db
      .query("proofItems")
      .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
      .first(),
  ]);
  const items = await ctx.db
    .query("proofItems")
    .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
    .collect();
  return {
    proofId: proof._id,
    causeId: proof.causeId,
    causeTitle: cause?.title ?? "",
    organization: structure?.name ?? "",
    itemCount: items.length,
    coverUrl: firstItem ? await ctx.storage.getUrl(firstItem.fileId) : null,
    validatedAt: proof.validatedAt ?? null,
  };
}

/** Validated dossiers for the public home feed (no auth), newest first. */
export const publicFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<ProofFeedCard[]> => {
    const proofs = await ctx.db
      .query("proofs")
      .withIndex("by_status", (q) => q.eq("status", "validated"))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 12, 1), 48));
    return Promise.all(proofs.map((p) => toFeedCard(ctx, p)));
  },
});

/** Validated dossiers of the causes the signed-in donor has given to. */
export const mine = query({
  args: {},
  handler: async (ctx): Promise<ProofFeedCard[]> => {
    const viewer = await viewerOf(ctx);
    if (!viewer || viewer.role !== "donor") return [];
    const donations = await ctx.db
      .query("donations")
      .withIndex("by_donor", (q) => q.eq("donorId", viewer._id))
      .collect();
    const causeIds = [...new Set(donations.map((d) => d.causeId))];
    const cards: ProofFeedCard[] = [];
    for (const causeId of causeIds) {
      const proof = await ctx.db
        .query("proofs")
        .withIndex("by_cause", (q) => q.eq("causeId", causeId))
        .unique();
      if (proof && proof.status === "validated") cards.push(await toFeedCard(ctx, proof));
    }
    cards.sort((a, b) => (b.validatedAt ?? 0) - (a.validatedAt ?? 0));
    return cards;
  },
});

// ---------------------------------------------------------------------------
// Internal: data + flag writes for the image-check action (convex/proofChecks.ts)
// ---------------------------------------------------------------------------

export const checkData = internalQuery({
  args: { proofId: v.id("proofs") },
  handler: async (ctx, { proofId }) => {
    const proof = await ctx.db.get(proofId);
    if (!proof) return null;
    const cause = await ctx.db.get(proof.causeId);
    const items = await ctx.db
      .query("proofItems")
      .withIndex("by_proof", (q) => q.eq("proofId", proofId))
      .collect();

    // sha256 of every photo file already in a validated dossier (exact-duplicate detection).
    const published = await ctx.db
      .query("proofs")
      .withIndex("by_status", (q) => q.eq("status", "validated"))
      .collect();
    const publishedHashes: string[] = [];
    for (const other of published) {
      if (other._id === proofId) continue;
      const otherItems = await ctx.db
        .query("proofItems")
        .withIndex("by_proof", (q) => q.eq("proofId", other._id))
        .collect();
      for (const it of otherItems) {
        const meta = await ctx.db.system.get(it.fileId);
        if (meta?.sha256) publishedHashes.push(meta.sha256);
      }
    }

    const photos = [];
    for (const item of items) {
      if (item.kind !== "photo") continue;
      const meta = await ctx.db.system.get(item.fileId);
      photos.push({ id: item._id, fileId: item.fileId, sha256: meta?.sha256 ?? null });
    }
    return { causeCreatedAt: cause?._creationTime ?? 0, photos, publishedHashes };
  },
});

export const applyImageFlags = internalMutation({
  args: {
    flags: v.array(v.object({ itemId: v.id("proofItems"), reason: v.string() })),
  },
  handler: async (ctx, { flags }) => {
    for (const flag of flags) {
      const item = await ctx.db.get(flag.itemId);
      if (!item || item.flagged) continue; // keep the earlier (logic) flag if any
      await ctx.db.patch(flag.itemId, { flagged: true, flagReason: flag.reason });
    }
  },
});
