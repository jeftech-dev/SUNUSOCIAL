// Blood-donation module (Sprint 7, DB-10, DT-26): hospital alerts targeted by group + commune,
// donor responses with a visit slot, stock, attendee confirmation and thanks. Donor addresses and
// phones are never exposed to hospitals: only first name, group, commune and slot.

import { v } from "convex/values";

import {
  BLOOD_ALERTS_PER_HOUR,
  BLOOD_ALERT_DURATION_MS,
  BLOOD_FANOUT_BATCH,
  REMINDER_LEAD_MS,
  THANKS_MAX_LENGTH,
  THANKS_MIN_LENGTH,
  alertDeadline,
  isValidSlot,
  slotLabel,
} from "../lib/bloodSlots";
import { isValidCommune } from "../lib/geo";
import { fr } from "../lib/strings.fr";
import { BLOOD_TYPES, KNOWN_BLOOD_TYPES, type BloodType } from "../lib/types";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logAudit } from "./audit";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/guards";
import { hitRateLimit } from "./lib/rateLimit";
import { notifyUser } from "./notify";
import { bloodAlertLevelV, bloodTypeV } from "./validators";

const HOUR_MS = 60 * 60 * 1000;
const MAX_UNITS = 500;
const MAX_STOCK = 9999;
/** Most responses read per alert (a hospital never needs more on one screen). */
const MAX_RESPONSES = 500;
const EXPIRE_BATCH = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The caller's hospital, or an error unless it is approved and not suspended. */
async function requireActiveHospital(ctx: QueryCtx) {
  const { user } = await requireRole(ctx, "hospital");
  const structure = user.structureId ? await ctx.db.get(user.structureId) : null;
  if (!structure || structure.status !== "approved" || structure.suspendedAt !== undefined) {
    throw appError("FORBIDDEN", fr.errors.hospitalNotApproved);
  }
  return { user, structure };
}

async function getOwnedAlert(
  ctx: QueryCtx,
  alertId: Id<"bloodAlerts">,
  hospitalId: Id<"structures">,
) {
  const alert = await ctx.db.get(alertId);
  // A foreign alert looks like a missing one: no probing of other hospitals' ids.
  if (!alert || alert.hospitalId !== hospitalId) {
    throw appError("NOT_FOUND", fr.errors.alertNotFound);
  }
  return alert;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function groupsLabel(alert: Pick<Doc<"bloodAlerts">, "anyType" | "bloodTypes">): string {
  return alert.anyType
    ? fr.blood.allGroups
    : alert.bloodTypes.map((t) => fr.bloodTypes[t]).join(", ");
}

/** Interim (G16): a group matches exactly; "Tous groupes" reaches everyone, unknown included. */
function matchesGroup(
  alert: Pick<Doc<"bloodAlerts">, "anyType" | "bloodTypes">,
  bloodType: BloodType | undefined,
): boolean {
  if (alert.anyType) return true;
  return bloodType !== undefined && alert.bloodTypes.includes(bloodType);
}

function isOpen(alert: Doc<"bloodAlerts">, now: number): boolean {
  return !alert.closed && now < alertDeadline(alert);
}

function isActive(response: Doc<"bloodResponses">): boolean {
  return response.cancelledAt === undefined;
}

function responseSlotLabel(response: Doc<"bloodResponses">, now: number): string {
  return response.slotStart !== undefined ? slotLabel(response.slotStart, now) : response.slot;
}

function hospitalUser(ctx: QueryCtx, structureId: Id<"structures">): Promise<Doc<"users"> | null> {
  return ctx.db
    .query("users")
    .withIndex("by_structure", (q) => q.eq("structureId", structureId))
    .first();
}

async function cancelReminder(ctx: MutationCtx, response: Doc<"bloodResponses">) {
  if (!response.reminderJobId) return;
  try {
    await ctx.scheduler.cancel(response.reminderJobId);
  } catch {
    // Already ran or was removed: nothing left to cancel.
  }
}

interface TargetInput {
  bloodTypes: BloodType[];
  anyType: boolean;
  targetCommunes: string[];
}

/** Opted-in donors per commune that an alert with this targeting would reach. */
async function countRecipients(ctx: QueryCtx, input: TargetInput) {
  const types = input.anyType ? [...BLOOD_TYPES] : input.bloodTypes;
  const perCommune: Array<{ commune: string; count: number }> = [];
  let total = 0;
  for (const commune of input.targetCommunes) {
    let count = 0;
    for (const bloodType of types) {
      const rows = await ctx.db
        .query("donorProfiles")
        .withIndex("by_optin_type_commune", (q) =>
          q.eq("bloodOptIn", true).eq("bloodType", bloodType).eq("commune", commune),
        )
        .take(5000);
      count += rows.length;
    }
    perCommune.push({ commune, count });
    total += count;
  }
  return { total, perCommune };
}

function cleanTypes(types: BloodType[]): Exclude<BloodType, "unknown">[] {
  const known = new Set<string>(KNOWN_BLOOD_TYPES);
  return [...new Set(types)].filter((t): t is Exclude<BloodType, "unknown"> => known.has(t));
}

async function upsertStock(
  ctx: MutationCtx,
  hospitalId: Id<"structures">,
  bloodType: BloodType,
  change: (current: number) => number,
): Promise<{ before: number; after: number }> {
  const row = await ctx.db
    .query("bloodStock")
    .withIndex("by_hospital_type", (q) => q.eq("hospitalId", hospitalId).eq("bloodType", bloodType))
    .unique();
  const before = row?.units ?? 0;
  const after = change(before);
  if (row) await ctx.db.patch(row._id, { units: after, updatedAt: Date.now() });
  else
    await ctx.db.insert("bloodStock", {
      hospitalId,
      bloodType,
      units: after,
      updatedAt: Date.now(),
    });
  return { before, after };
}

async function stockRows(ctx: QueryCtx, hospitalId: Id<"structures">) {
  const rows = await ctx.db
    .query("bloodStock")
    .withIndex("by_hospital_type", (q) => q.eq("hospitalId", hospitalId))
    .collect();
  const byType = new Map(rows.map((row) => [row.bloodType, row]));
  return {
    entries: KNOWN_BLOOD_TYPES.map((bloodType) => ({
      bloodType,
      units: byType.get(bloodType)?.units ?? 0,
    })),
    updatedAt: rows.reduce<number | null>((max, row) => Math.max(max ?? 0, row.updatedAt), null),
  };
}

/**
 * Closes an alert (hospital, moderator or expiry) and tells donors who answered but whose donation
 * is not confirmed that they no longer need to come (BLOOD-B). Their reminders are cancelled.
 */
export async function closeAlertInternal(
  ctx: MutationCtx,
  alert: Doc<"bloodAlerts">,
  { by, reason, moderator }: { by?: Id<"users">; reason?: string; moderator: boolean },
): Promise<void> {
  if (alert.closed) return;
  await ctx.db.patch(alert._id, {
    closed: true,
    closedAt: Date.now(),
    ...(by ? { closedBy: by } : {}),
    ...(reason ? { closeReason: reason } : {}),
    closedByModerator: moderator,
  });
  const hospital = await ctx.db.get(alert.hospitalId);
  const hospitalName = hospital?.name ?? "";
  const responses = await ctx.db
    .query("bloodResponses")
    .withIndex("by_alert", (q) => q.eq("alertId", alert._id))
    .take(MAX_RESPONSES);
  for (const response of responses) {
    if (response.donated || !isActive(response)) continue;
    await cancelReminder(ctx, response);
    const profile = await ctx.db
      .query("donorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", response.donorId))
      .unique();
    await notifyUser(ctx, {
      userId: response.donorId,
      kind: "blood_alert_closed",
      title: fr.notifications.bloodClosedTitle,
      body: fr.notifications.bloodClosedBody(hospitalName),
      link: "/sang",
      ...(profile?.smsOptIn ? { sms: fr.sms.bloodClosed(hospitalName) } : {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Hospital: alerts
// ---------------------------------------------------------------------------

const targetArgs = {
  bloodTypes: v.array(bloodTypeV),
  anyType: v.boolean(),
  targetCommunes: v.array(v.string()),
};

/** Live reach for the composer: opted-in donors that would receive this alert. */
export const previewRecipients = query({
  args: targetArgs,
  handler: async (ctx, args) => {
    const { structure } = await requireActiveHospital(ctx);
    const targetCommunes = [...new Set(args.targetCommunes)].filter((c) =>
      isValidCommune(structure.region, c),
    );
    return countRecipients(ctx, {
      bloodTypes: cleanTypes(args.bloodTypes),
      anyType: args.anyType,
      targetCommunes,
    });
  },
});

export const createAlert = mutation({
  args: {
    ...targetArgs,
    level: bloodAlertLevelV,
    unitsNeeded: v.number(),
    channels: v.object({ inApp: v.boolean(), sms: v.boolean() }),
  },
  handler: async (ctx, args) => {
    const { user, structure } = await requireActiveHospital(ctx);
    const bloodTypes = args.anyType ? [] : cleanTypes(args.bloodTypes);
    if (!args.anyType && bloodTypes.length === 0) {
      throw appError("VALIDATION", fr.errors.alertGroupsRequired, "bloodTypes");
    }
    if (
      !Number.isInteger(args.unitsNeeded) ||
      args.unitsNeeded < 1 ||
      args.unitsNeeded > MAX_UNITS
    ) {
      throw appError("VALIDATION", fr.errors.alertUnitsInvalid, "unitsNeeded");
    }
    const targetCommunes = [...new Set(args.targetCommunes)];
    if (targetCommunes.length === 0) {
      throw appError("VALIDATION", fr.errors.alertCommunesRequired, "targetCommunes");
    }
    if (!targetCommunes.every((c) => isValidCommune(structure.region, c))) {
      throw appError("VALIDATION", fr.errors.communeOutsideRegion, "targetCommunes");
    }
    if (!args.channels.inApp && !args.channels.sms) {
      throw appError("VALIDATION", fr.errors.alertChannelRequired, "channels");
    }
    const limit = await hitRateLimit(ctx, `blood:alert:${structure._id}`, {
      max: BLOOD_ALERTS_PER_HOUR,
      windowMs: HOUR_MS,
    });
    if (!limit.ok) throw appError("RATE_LIMITED", fr.errors.alertRateLimited);

    const { total } = await countRecipients(ctx, {
      bloodTypes,
      anyType: args.anyType,
      targetCommunes,
    });
    const now = Date.now();
    const alertId = await ctx.db.insert("bloodAlerts", {
      hospitalId: structure._id,
      bloodTypes,
      anyType: args.anyType,
      level: args.level,
      unitsNeeded: args.unitsNeeded,
      unitsCollected: 0,
      targetCommunes,
      estimatedRecipients: total,
      channels: args.channels,
      closed: false,
      createdBy: user._id,
      createdAt: now,
      deadlineAt: now + BLOOD_ALERT_DURATION_MS[args.level],
      notifiedCount: 0,
    });
    await logAudit(ctx, {
      actorId: user._id,
      action: "blood.alert.create",
      targetTable: "bloodAlerts",
      targetId: alertId,
      details: { level: args.level, estimatedRecipients: total },
    });
    await ctx.scheduler.runAfter(0, internal.blood.fanOutAlert, { alertId, comboIndex: 0 });
    return { alertId, estimatedRecipients: total };
  },
});

/**
 * Notifies the matching donors, one (group × commune) combination at a time and one page of
 * profiles per run (BLOOD-C), so a large audience never runs in one transaction. SMS go out as one
 * batch per page, to opted-in donors only.
 */
export const fanOutAlert = internalMutation({
  args: {
    alertId: v.id("bloodAlerts"),
    comboIndex: v.number(),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { alertId, comboIndex, cursor }): Promise<void> => {
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.closed) return;
    const types: BloodType[] = alert.anyType ? [...BLOOD_TYPES] : alert.bloodTypes;
    const combos = types.flatMap((bloodType) =>
      alert.targetCommunes.map((commune) => ({ bloodType, commune })),
    );
    const combo = combos[comboIndex];
    if (!combo) return;

    const hospital = await ctx.db.get(alert.hospitalId);
    const hospitalName = hospital?.name ?? "";
    const result = await ctx.db
      .query("donorProfiles")
      .withIndex("by_optin_type_commune", (q) =>
        q.eq("bloodOptIn", true).eq("bloodType", combo.bloodType).eq("commune", combo.commune),
      )
      .paginate({ cursor: cursor ?? null, numItems: BLOOD_FANOUT_BATCH });

    const level = fr.bloodAlertLevels[alert.level];
    const groups = groupsLabel(alert);
    const sms: Array<{ to: string; text: string }> = [];
    let notified = 0;
    for (const profile of result.page) {
      const donor = await ctx.db.get(profile.userId);
      if (!donor || donor.disabled) continue;
      notified += 1;
      if (alert.channels.inApp) {
        await notifyUser(ctx, {
          userId: donor._id,
          kind: "blood_alert",
          title: fr.notifications.bloodAlertTitle(groups),
          body: fr.notifications.bloodAlertBody(hospitalName, level),
          link: "/sang",
        });
      }
      if (alert.channels.sms && profile.smsOptIn && donor.phone) {
        sms.push({
          to: donor.phone,
          text: fr.sms.bloodAlert(hospitalName, groups, level, alert.targetCommunes.join(", ")),
        });
      }
    }
    if (sms.length > 0) {
      await ctx.scheduler.runAfter(0, internal.notify.sendSmsBatch, { messages: sms });
    }
    await ctx.db.patch(alertId, { notifiedCount: (alert.notifiedCount ?? 0) + notified });

    if (!result.isDone) {
      await ctx.scheduler.runAfter(1000, internal.blood.fanOutAlert, {
        alertId,
        comboIndex,
        cursor: result.continueCursor,
      });
    } else if (comboIndex + 1 < combos.length) {
      await ctx.scheduler.runAfter(0, internal.blood.fanOutAlert, {
        alertId,
        comboIndex: comboIndex + 1,
      });
    }
  },
});

export const getStock = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireRole(ctx, "hospital");
    if (!user.structureId) return null;
    return stockRows(ctx, user.structureId);
  },
});

export const updateStock = mutation({
  args: { entries: v.array(v.object({ bloodType: bloodTypeV, units: v.number() })) },
  handler: async (ctx, { entries }) => {
    const { structure } = await requireActiveHospital(ctx);
    for (const entry of entries) {
      if (
        entry.bloodType === "unknown" ||
        !Number.isInteger(entry.units) ||
        entry.units < 0 ||
        entry.units > MAX_STOCK
      ) {
        throw appError("VALIDATION", fr.errors.stockInvalid, "units");
      }
    }
    for (const entry of entries) {
      await upsertStock(ctx, structure._id, entry.bloodType, () => entry.units);
    }
    return { ok: true as const };
  },
});

/** Stock plus the hospital's open alerts and the 10 latest closed ones, with their responders. */
export const hospitalOverview = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireRole(ctx, "hospital");
    if (!user.structureId) return null;
    const hospitalId = user.structureId;
    const now = Date.now();
    const open = await ctx.db
      .query("bloodAlerts")
      .withIndex("by_hospital_closed", (q) => q.eq("hospitalId", hospitalId).eq("closed", false))
      .order("desc")
      .take(50);
    const closed = await ctx.db
      .query("bloodAlerts")
      .withIndex("by_hospital_closed", (q) => q.eq("hospitalId", hospitalId).eq("closed", true))
      .order("desc")
      .take(10);
    const alerts = [];
    for (const alert of [...open, ...closed]) {
      const responses = await ctx.db
        .query("bloodResponses")
        .withIndex("by_alert", (q) => q.eq("alertId", alert._id))
        .take(MAX_RESPONSES);
      const responders = [];
      for (const response of responses) {
        const donor = await ctx.db.get(response.donorId);
        responders.push({
          responseId: response._id,
          firstName: donor ? firstName(donor.name) : "",
          bloodType: response.donatedType ?? response.bloodType,
          commune: response.commune,
          slotLabel: responseSlotLabel(response, now),
          status: response.donated
            ? ("donated" as const)
            : isActive(response)
              ? ("pending" as const)
              : ("cancelled" as const),
        });
      }
      alerts.push({
        _id: alert._id,
        level: alert.level,
        bloodTypes: alert.bloodTypes,
        anyType: alert.anyType ?? false,
        targetCommunes: alert.targetCommunes,
        unitsNeeded: alert.unitsNeeded,
        unitsCollected: alert.unitsCollected,
        estimatedRecipients: alert.estimatedRecipients,
        notifiedCount: alert.notifiedCount ?? 0,
        closed: alert.closed || now >= alertDeadline(alert),
        closeReason: alert.closeReason ?? null,
        closedByModerator: alert.closedByModerator ?? false,
        thanksSent: alert.thanksSentAt !== undefined,
        thanksMessage: alert.thanksMessage ?? null,
        deadlineAt: alertDeadline(alert),
        createdAt: alert.createdAt,
        responders,
      });
    }
    return { stock: await stockRows(ctx, hospitalId), alerts };
  },
});

export const confirmDonation = mutation({
  args: { responseId: v.id("bloodResponses"), bloodType: v.optional(bloodTypeV) },
  handler: async (ctx, { responseId, bloodType }) => {
    const { user, structure } = await requireActiveHospital(ctx);
    const response = await ctx.db.get(responseId);
    if (!response) throw appError("NOT_FOUND", fr.errors.responseNotFound);
    const alert = await getOwnedAlert(ctx, response.alertId, structure._id);
    if (response.donated) throw appError("CONFLICT", fr.errors.donationAlreadyConfirmed);
    if (!isActive(response)) throw appError("CONFLICT", fr.errors.responseNotActive);

    let donatedType: BloodType = response.bloodType;
    if (donatedType === "unknown") {
      if (!bloodType || bloodType === "unknown") {
        throw appError("VALIDATION", fr.errors.donatedTypeRequired, "bloodType");
      }
      donatedType = bloodType;
    }
    await cancelReminder(ctx, response);
    await ctx.db.patch(response._id, {
      donated: true,
      confirmedAt: Date.now(),
      confirmedBy: user._id,
      donatedType,
    });
    await ctx.db.patch(alert._id, { unitsCollected: alert.unitsCollected + 1 });
    const { before, after } = await upsertStock(ctx, structure._id, donatedType, (n) => n + 1);
    return { bloodType: donatedType, stockBefore: before, stockAfter: after };
  },
});

export const closeAlert = mutation({
  args: { alertId: v.id("bloodAlerts") },
  handler: async (ctx, { alertId }) => {
    const { user, structure } = await requireActiveHospital(ctx);
    const alert = await getOwnedAlert(ctx, alertId, structure._id);
    await closeAlertInternal(ctx, alert, { by: user._id, moderator: false });
    return { ok: true as const };
  },
});

/** Thanks go only to donors whose donation was confirmed, once per alert. */
export const sendThanks = mutation({
  args: { alertId: v.id("bloodAlerts"), message: v.string() },
  handler: async (ctx, { alertId, message }) => {
    const { structure } = await requireActiveHospital(ctx);
    const alert = await getOwnedAlert(ctx, alertId, structure._id);
    const text = message.trim();
    if (text.length < THANKS_MIN_LENGTH || text.length > THANKS_MAX_LENGTH) {
      throw appError(
        "VALIDATION",
        fr.errors.thanksLength(THANKS_MIN_LENGTH, THANKS_MAX_LENGTH),
        "message",
      );
    }
    const finished = alert.closed || alert.unitsCollected >= alert.unitsNeeded;
    const responses = await ctx.db
      .query("bloodResponses")
      .withIndex("by_alert", (q) => q.eq("alertId", alertId))
      .take(MAX_RESPONSES);
    const donated = responses.filter((r) => r.donated);
    if (!finished || alert.thanksSentAt !== undefined || donated.length === 0) {
      throw appError("CONFLICT", fr.errors.thanksNotAllowed);
    }
    await ctx.db.patch(alertId, { thanksMessage: text, thanksSentAt: Date.now() });
    for (const response of donated) {
      const profile = await ctx.db
        .query("donorProfiles")
        .withIndex("by_user", (q) => q.eq("userId", response.donorId))
        .unique();
      await notifyUser(ctx, {
        userId: response.donorId,
        kind: "blood_thanks",
        title: fr.notifications.bloodThanksTitle(structure.name),
        body: text,
        link: "/sang",
        ...(profile?.smsOptIn ? { sms: text } : {}),
      });
    }
    return { ok: true as const, thanked: donated.length };
  },
});

/** Hourly: closes alerts past their deadline. */
export const closeExpired = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const now = Date.now();
    const due = await ctx.db
      .query("bloodAlerts")
      .withIndex("by_closed_deadline", (q) => q.eq("closed", false).lt("deadlineAt", now))
      .take(EXPIRE_BATCH);
    for (const alert of due) await closeAlertInternal(ctx, alert, { moderator: false });
    if (due.length === EXPIRE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.blood.closeExpired, {});
    }
  },
});

// ---------------------------------------------------------------------------
// Donor
// ---------------------------------------------------------------------------

export const alertsForDonor = query({
  args: { scope: v.union(v.literal("mine"), v.literal("all")) },
  handler: async (ctx, { scope }) => {
    const { user } = await requireRole(ctx, "donor");
    const profile = await ctx.db
      .query("donorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const optedIn = profile?.bloodOptIn === true;
    const now = Date.now();
    const open = await ctx.db
      .query("bloodAlerts")
      .withIndex("by_closed", (q) => q.eq("closed", false))
      .order("desc")
      .take(100);

    const alerts = [];
    let pendingCount = 0;
    for (const alert of open) {
      if (!isOpen(alert, now)) continue;
      const compatibleForMe =
        optedIn &&
        matchesGroup(alert, profile?.bloodType) &&
        profile?.commune !== undefined &&
        alert.targetCommunes.includes(profile.commune);
      if (scope === "mine" && !compatibleForMe) continue;
      const hospital = await ctx.db.get(alert.hospitalId);
      const responses = await ctx.db
        .query("bloodResponses")
        .withIndex("by_alert", (q) => q.eq("alertId", alert._id))
        .take(MAX_RESPONSES);
      const mine = responses.find((r) => r.donorId === user._id);
      const myResponse =
        mine && isActive(mine) ? { slotLabel: responseSlotLabel(mine, now) } : null;
      if (compatibleForMe && !myResponse) pendingCount += 1;
      alerts.push({
        _id: alert._id,
        hospitalName: hospital?.name ?? "",
        hospitalCommune: hospital?.commune ?? "",
        level: alert.level,
        bloodTypes: alert.bloodTypes,
        anyType: alert.anyType ?? false,
        targetCommunes: alert.targetCommunes,
        unitsNeeded: alert.unitsNeeded,
        unitsCollected: alert.unitsCollected,
        respondersCount: responses.filter((r) => isActive(r) && !r.donated).length,
        deadlineAt: alertDeadline(alert),
        compatibleForMe,
        myResponse,
      });
    }
    return {
      optedIn,
      bloodType: profile?.bloodType ?? null,
      commune: profile?.commune ?? null,
      alerts,
      pendingCount,
    };
  },
});

export const respond = mutation({
  args: { alertId: v.id("bloodAlerts"), slotStart: v.number() },
  handler: async (ctx, { alertId, slotStart }) => {
    const { user } = await requireRole(ctx, "donor");
    const alert = await ctx.db.get(alertId);
    if (!alert) throw appError("NOT_FOUND", fr.errors.alertNotFound);
    const now = Date.now();
    if (!isOpen(alert, now)) throw appError("CONFLICT", fr.errors.alertClosed);

    const profile = await ctx.db
      .query("donorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile?.bloodOptIn || !profile.commune) {
      throw appError("FORBIDDEN", fr.errors.bloodNotOptedIn);
    }
    if (
      !matchesGroup(alert, profile.bloodType) ||
      !alert.targetCommunes.includes(profile.commune)
    ) {
      throw appError("FORBIDDEN", fr.errors.notCompatible);
    }
    if (!isValidSlot(slotStart, now, alertDeadline(alert))) {
      throw appError("VALIDATION", fr.errors.slotInvalid, "slotStart");
    }
    const existing = await ctx.db
      .query("bloodResponses")
      .withIndex("by_alert_donor", (q) => q.eq("alertId", alertId).eq("donorId", user._id))
      .unique();
    if (existing && (isActive(existing) || existing.donated)) {
      throw appError("CONFLICT", fr.errors.alreadyResponded);
    }

    const label = slotLabel(slotStart, now);
    const fields = {
      bloodType: profile.bloodType ?? ("unknown" as const),
      commune: profile.commune,
      slot: label,
      slotStart,
      slotEnd: slotStart + 2 * HOUR_MS,
      donated: false,
      cancelledAt: undefined,
    };
    let responseId: Id<"bloodResponses">;
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      responseId = existing._id;
    } else {
      responseId = await ctx.db.insert("bloodResponses", {
        alertId,
        donorId: user._id,
        createdAt: now,
        ...fields,
      });
    }
    if (slotStart - REMINDER_LEAD_MS > now) {
      const reminderJobId = await ctx.scheduler.runAt(
        slotStart - REMINDER_LEAD_MS,
        internal.blood.sendReminder,
        { responseId },
      );
      await ctx.db.patch(responseId, { reminderJobId });
    }
    const hospital = await hospitalUser(ctx, alert.hospitalId);
    if (hospital) {
      await notifyUser(ctx, {
        userId: hospital._id,
        kind: "blood_response",
        title: fr.notifications.bloodResponseTitle,
        body: fr.notifications.bloodResponseBody(
          firstName(user.name),
          fr.bloodTypes[fields.bloodType],
          label,
        ),
        link: "/hopital",
      });
    }
    return { slotLabel: label };
  },
});

/** Interim (G14): a donor may cancel until the slot ends, unless the donation is confirmed. */
export const cancelResponse = mutation({
  args: { alertId: v.id("bloodAlerts") },
  handler: async (ctx, { alertId }) => {
    const { user } = await requireRole(ctx, "donor");
    const response = await ctx.db
      .query("bloodResponses")
      .withIndex("by_alert_donor", (q) => q.eq("alertId", alertId).eq("donorId", user._id))
      .unique();
    if (!response || !isActive(response)) throw appError("NOT_FOUND", fr.errors.responseNotFound);
    const now = Date.now();
    if (response.donated || (response.slotEnd !== undefined && now >= response.slotEnd)) {
      throw appError("CONFLICT", fr.errors.cancelTooLate);
    }
    await cancelReminder(ctx, response);
    await ctx.db.patch(response._id, { cancelledAt: now, reminderJobId: undefined });
    const alert = await ctx.db.get(alertId);
    const hospital = alert ? await hospitalUser(ctx, alert.hospitalId) : null;
    if (hospital) {
      await notifyUser(ctx, {
        userId: hospital._id,
        kind: "blood_response",
        title: fr.notifications.bloodCancelTitle,
        body: fr.notifications.bloodCancelBody(
          firstName(user.name),
          fr.bloodTypes[response.bloodType],
          responseSlotLabel(response, now),
        ),
        link: "/hopital",
      });
    }
    return { ok: true as const };
  },
});

/** Scheduled 2 h before the slot; does nothing if the donor cancelled or the alert closed. */
export const sendReminder = internalMutation({
  args: { responseId: v.id("bloodResponses") },
  handler: async (ctx, { responseId }): Promise<void> => {
    const response = await ctx.db.get(responseId);
    if (!response || response.donated || !isActive(response)) return;
    const alert = await ctx.db.get(response.alertId);
    if (!alert || alert.closed) return;
    const hospital = await ctx.db.get(alert.hospitalId);
    const profile = await ctx.db
      .query("donorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", response.donorId))
      .unique();
    const slot = responseSlotLabel(response, response.slotStart ?? Date.now());
    const hospitalName = hospital?.name ?? "";
    await notifyUser(ctx, {
      userId: response.donorId,
      kind: "blood_reminder",
      title: fr.notifications.bloodReminderTitle,
      body: fr.notifications.bloodReminderBody(hospitalName, slot),
      link: "/sang",
      ...(profile?.smsOptIn ? { sms: fr.sms.bloodReminder(hospitalName, slot) } : {}),
    });
  },
});
