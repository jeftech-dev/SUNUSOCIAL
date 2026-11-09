/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLOT_LENGTH_MS, slotOptions } from "../lib/bloodSlots";
import { DAY_MS } from "../lib/config";
import { HOSPITAL_TYPE, type BloodType } from "../lib/types";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { adjustBloodReach } from "./lib/bloodReach";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

let logs: string[] = [];
beforeEach(() => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

function errorData(error: unknown): { code?: string } {
  const data = (error as { data?: unknown }).data;
  return typeof data === "string" ? JSON.parse(data) : ((data as object) ?? {});
}
async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).not.toBeNull();
  expect(errorData(error).code).toBe(code);
}

const smsTo = (phone: string) => logs.filter((l) => l.startsWith(`[SMS console] to ${phone}:`));

async function session(t: T, userId: Id<"users">, mfa = true) {
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
      ...(mfa ? { mfaVerifiedAt: Date.now() } : {}),
    }),
  );
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

let hospitalSeq = 0;
async function hospitalCtx(
  t: T,
  { status = "approved", suspended = false, mfa = true, region = "Dakar" } = {},
) {
  hospitalSeq += 1;
  const receiptFileId = await t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(16)], { type: "application/pdf" })),
  );
  const structureId = await t.run((ctx) =>
    ctx.db.insert("structures", {
      name: `Hôpital ${hospitalSeq}`,
      type: HOSPITAL_TYPE,
      region,
      commune: "Dakar-Plateau",
      contactName: "Dr Sy",
      phone: `+22177100${String(hospitalSeq).padStart(4, "0")}`,
      email: `h${hospitalSeq}@example.sn`,
      receiptFileId,
      status: status as "approved" | "pending",
      ...(suspended ? { suspendedAt: Date.now() } : {}),
      onboardingPhase: 1 as const,
      createdAt: Date.now(),
    }),
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Dr Sy",
      role: "hospital",
      structureId,
      phone: `+22177100${String(hospitalSeq).padStart(4, "0")}`,
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  return { structureId, userId, client: await session(t, userId, mfa) };
}

let donorSeq = 0;
async function donorCtx(
  t: T,
  {
    name = "Aminata Diop",
    bloodType = "O+" as BloodType | undefined,
    commune = "Médina",
    optIn = true,
    smsOptIn = true,
  } = {},
) {
  donorSeq += 1;
  const phone = `+22177200${String(donorSeq).padStart(4, "0")}`;
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name, role: "donor", phone, disabled: false, createdAt: Date.now() }),
  );
  await t.run(async (ctx) => {
    const profile = {
      userId,
      bloodOptIn: optIn,
      ...(bloodType ? { bloodType } : {}),
      region: "Dakar",
      commune,
      smsOptIn,
      updatedAt: Date.now(),
    };
    await ctx.db.insert("donorProfiles", profile);
    await adjustBloodReach(ctx, null, profile);
  });
  return { userId, phone, client: await session(t, userId) };
}

async function moderatorClient(t: T) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Mod",
      role: "moderator",
      disabled: false,
      createdAt: Date.now(),
    }),
  );
  return { userId, client: await session(t, userId) };
}

const baseAlert = {
  bloodTypes: ["O+" as BloodType],
  anyType: false,
  level: "vitale" as const,
  unitsNeeded: 5,
  targetCommunes: ["Médina"],
  channels: { inApp: true, sms: true },
};

async function sendAlert(t: T, hospital: Awaited<ReturnType<typeof hospitalCtx>>, over = {}) {
  const result = await hospital.client.mutation(api.blood.createAlert, { ...baseAlert, ...over });
  await t.finishAllScheduledFunctions(() => {});
  return result;
}

/** A start the server accepts right now (tomorrow always has windows). */
function aSlot(alertDeadline = Date.now() + DAY_MS) {
  const options = slotOptions(Date.now(), alertDeadline);
  expect(options.length).toBeGreaterThan(0);
  return options[0].start;
}

const notificationsOf = (t: T, userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId))
      .collect(),
  );

describe("hospital guards", () => {
  it("rejects pending, suspended, non-MFA and wrong-role callers", async () => {
    const t = setup();
    const pending = await hospitalCtx(t, { status: "pending" });
    const suspended = await hospitalCtx(t, { suspended: true });
    const noMfa = await hospitalCtx(t, { mfa: false });
    const donor = await donorCtx(t);
    await expectAppError(pending.client.mutation(api.blood.createAlert, baseAlert), "FORBIDDEN");
    await expectAppError(suspended.client.mutation(api.blood.createAlert, baseAlert), "FORBIDDEN");
    await expectAppError(noMfa.client.mutation(api.blood.createAlert, baseAlert), "MFA_REQUIRED");
    await expectAppError(donor.client.mutation(api.blood.createAlert, baseAlert), "FORBIDDEN");
  });

  it("hides one hospital's alerts from another", async () => {
    const t = setup();
    const a = await hospitalCtx(t);
    const b = await hospitalCtx(t);
    const { alertId } = await sendAlert(t, a);
    await expectAppError(b.client.mutation(api.blood.closeAlert, { alertId }), "NOT_FOUND");
    await expectAppError(
      b.client.mutation(api.blood.sendThanks, { alertId, message: "Merci beaucoup à tous" }),
      "NOT_FOUND",
    );
  });
});

describe("createAlert", () => {
  it("validates groups, units, communes and channels", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const create = (over: object) =>
      h.client.mutation(api.blood.createAlert, { ...baseAlert, ...over });
    await expectAppError(create({ bloodTypes: [] }), "VALIDATION");
    await expectAppError(create({ bloodTypes: ["unknown"] }), "VALIDATION");
    await expectAppError(create({ unitsNeeded: 0 }), "VALIDATION");
    await expectAppError(create({ unitsNeeded: 2.5 }), "VALIDATION");
    await expectAppError(create({ targetCommunes: [] }), "VALIDATION");
    await expectAppError(create({ targetCommunes: ["Mbour"] }), "VALIDATION");
    await expectAppError(create({ channels: { inApp: false, sms: false } }), "VALIDATION");
  });

  it("refuses the 21st alert within an hour", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    for (let i = 0; i < 20; i += 1) {
      await h.client.mutation(api.blood.createAlert, baseAlert);
    }
    await expectAppError(h.client.mutation(api.blood.createAlert, baseAlert), "RATE_LIMITED");
  });

  it("follows profile changes in the reach counters", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const donor = await donorCtx(t);
    const reach = () =>
      h.client.query(api.blood.previewRecipients, {
        bloodTypes: ["O+"],
        anyType: false,
        targetCommunes: ["Médina", "Pikine"],
      });
    expect((await reach()).total).toBe(1);
    await donor.client.mutation(api.auth.updateBloodProfile, {
      optIn: true,
      bloodType: "O+",
      region: "Dakar",
      commune: "Pikine",
      smsOptIn: true,
    });
    expect((await reach()).perCommune).toEqual([
      { commune: "Médina", count: 0 },
      { commune: "Pikine", count: 1 },
    ]);
    await donor.client.mutation(api.auth.updateBloodProfile, {
      optIn: false,
      region: "Dakar",
      commune: "Pikine",
      smsOptIn: false,
    });
    expect((await reach()).total).toBe(0);
  });

  it("rebuilds the reach counters from the profiles", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    await donorCtx(t);
    await donorCtx(t, { bloodType: "A+" });
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("bloodReach").collect()) {
        await ctx.db.patch(row._id, { count: 42 });
      }
    });
    await t.mutation(internal.blood.rebuildReach, {});
    await t.finishAllScheduledFunctions(() => {});
    const preview = await h.client.query(api.blood.previewRecipients, {
      bloodTypes: [],
      anyType: true,
      targetCommunes: ["Médina"],
    });
    expect(preview.total).toBe(2);
  });

  it("returns the same estimate as the preview and logs the creation", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    await donorCtx(t);
    await donorCtx(t, { smsOptIn: false });
    await donorCtx(t, { bloodType: "A+" });
    const preview = await h.client.query(api.blood.previewRecipients, {
      bloodTypes: ["O+"],
      anyType: false,
      targetCommunes: ["Médina", "Pikine"],
    });
    expect(preview).toEqual({
      total: 2,
      perCommune: [
        { commune: "Médina", count: 2 },
        { commune: "Pikine", count: 0 },
      ],
    });
    const { estimatedRecipients, alertId } = await h.client.mutation(api.blood.createAlert, {
      ...baseAlert,
      targetCommunes: ["Médina", "Pikine"],
    });
    expect(estimatedRecipients).toBe(2);
    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_created", (q) => q.eq("action", "blood.alert.create"))
        .collect(),
    );
    expect(audit.map((a) => a.targetId)).toEqual([alertId]);
  });
});

describe("fan-out", () => {
  it("reaches only opted-in donors of the requested group and communes; SMS only if smsOptIn", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const sms = await donorCtx(t);
    const noSms = await donorCtx(t, { smsOptIn: false });
    const otherGroup = await donorCtx(t, { bloodType: "A+" });
    const otherCommune = await donorCtx(t, { commune: "Pikine" });
    const notOpted = await donorCtx(t, { optIn: false });
    const unknownGroup = await donorCtx(t, { bloodType: "unknown" });
    const { alertId } = await sendAlert(t, h);

    expect(await notificationsOf(t, sms.userId)).toHaveLength(1);
    expect(await notificationsOf(t, noSms.userId)).toHaveLength(1);
    for (const d of [otherGroup, otherCommune, notOpted, unknownGroup]) {
      expect(await notificationsOf(t, d.userId)).toHaveLength(0);
    }
    expect(smsTo(sms.phone)).toHaveLength(1);
    expect(smsTo(noSms.phone)).toHaveLength(0);
    const alert = await t.run((ctx) => ctx.db.get(alertId));
    expect(alert?.notifiedCount).toBe(2);
  });

  it("'Tous groupes' also reaches donors with an unknown group", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const unknown = await donorCtx(t, { bloodType: "unknown" });
    const other = await donorCtx(t, { bloodType: "A+" });
    await sendAlert(t, h, { anyType: true, bloodTypes: [] });
    expect(await notificationsOf(t, unknown.userId)).toHaveLength(1);
    expect(await notificationsOf(t, other.userId)).toHaveLength(1);
  });

  it("skips the SMS channel when the hospital turned it off", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const d = await donorCtx(t);
    await sendAlert(t, h, { channels: { inApp: true, sms: false } });
    expect(await notificationsOf(t, d.userId)).toHaveLength(1);
    expect(smsTo(d.phone)).toHaveLength(0);
  });

  it("pages through more than one batch", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i += 1) {
        const userId = await ctx.db.insert("users", {
          name: `Donneur ${i}`,
          role: "donor",
          disabled: false,
          createdAt: Date.now(),
        });
        const profile = {
          userId,
          bloodOptIn: true,
          bloodType: "O+" as const,
          region: "Dakar",
          commune: "Médina",
          smsOptIn: false,
          updatedAt: Date.now(),
        };
        await ctx.db.insert("donorProfiles", profile);
        await adjustBloodReach(ctx, null, profile);
      }
    });
    vi.useFakeTimers();
    const { alertId } = await h.client.mutation(api.blood.createAlert, baseAlert);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const alert = await t.run((ctx) => ctx.db.get(alertId));
    expect(alert?.notifiedCount).toBe(205);
  }, 20_000);
});

describe("donor responses", () => {
  it("lists compatible alerts and counts the unanswered ones", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const d = await donorCtx(t);
    const other = await donorCtx(t, { bloodType: "B-" });
    await sendAlert(t, h);
    const mine = await d.client.query(api.blood.alertsForDonor, { scope: "mine" });
    expect(mine.pendingCount).toBe(1);
    expect(mine.alerts[0]).toMatchObject({ compatibleForMe: true, myResponse: null });
    const all = await other.client.query(api.blood.alertsForDonor, { scope: "all" });
    expect(all.alerts[0].compatibleForMe).toBe(false);
    expect((await other.client.query(api.blood.alertsForDonor, { scope: "mine" })).alerts).toEqual(
      [],
    );
  });

  it("rejects incompatible, closed, badly-slotted and duplicate responses", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const d = await donorCtx(t);
    const other = await donorCtx(t, { bloodType: "B-" });
    const notOpted = await donorCtx(t, { optIn: false });
    const { alertId } = await sendAlert(t, h);
    const slotStart = aSlot();
    await expectAppError(
      other.client.mutation(api.blood.respond, { alertId, slotStart }),
      "FORBIDDEN",
    );
    await expectAppError(
      notOpted.client.mutation(api.blood.respond, { alertId, slotStart }),
      "FORBIDDEN",
    );
    await expectAppError(
      d.client.mutation(api.blood.respond, { alertId, slotStart: slotStart + 1 }),
      "VALIDATION",
    );
    await d.client.mutation(api.blood.respond, { alertId, slotStart });
    await expectAppError(d.client.mutation(api.blood.respond, { alertId, slotStart }), "CONFLICT");

    await h.client.mutation(api.blood.closeAlert, { alertId });
    await expectAppError(
      other.client.mutation(api.blood.respond, { alertId, slotStart }),
      "CONFLICT",
    );
  });

  it("schedules a reminder, cancels it, and lets the donor answer again", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const d = await donorCtx(t);
    const { alertId } = await sendAlert(t, h);
    const options = slotOptions(Date.now(), Date.now() + DAY_MS);
    const slotStart = options[options.length - 1].start;
    await d.client.mutation(api.blood.respond, { alertId, slotStart });
    const first = await t.run((ctx) =>
      ctx.db
        .query("bloodResponses")
        .withIndex("by_alert_donor", (q) => q.eq("alertId", alertId).eq("donorId", d.userId))
        .unique(),
    );
    expect(first?.slotStart).toBe(slotStart);
    // The hospital hears about it.
    expect((await notificationsOf(t, h.userId)).map((n) => n.kind)).toContain("blood_response");

    await d.client.mutation(api.blood.cancelResponse, { alertId });
    const cancelled = await t.run((ctx) => ctx.db.get(first!._id));
    expect(cancelled?.cancelledAt).toBeDefined();
    // A reminder that still fires after a cancel does nothing.
    await t.mutation(internal.blood.sendReminder, { responseId: first!._id });
    expect((await notificationsOf(t, d.userId)).map((n) => n.kind)).not.toContain("blood_reminder");

    await d.client.mutation(api.blood.respond, { alertId, slotStart });
    await t.mutation(internal.blood.sendReminder, { responseId: first!._id });
    await t.finishInProgressScheduledFunctions();
    expect((await notificationsOf(t, d.userId)).map((n) => n.kind)).toContain("blood_reminder");
  });
});

describe("hospital attendance and stock", () => {
  async function withResponse(donor = {}, alertOver = {}) {
    const t = setup();
    const h = await hospitalCtx(t);
    const d = await donorCtx(t, donor);
    const { alertId } = await sendAlert(t, h, alertOver);
    await d.client.mutation(api.blood.respond, { alertId, slotStart: aSlot() });
    const overview = await h.client.query(api.blood.hospitalOverview, {});
    const responseId = overview!.alerts[0].responders[0].responseId;
    return { t, h, d, alertId, responseId };
  }

  it("confirms a donation: stock +1, collected +1, once only", async () => {
    const { t, h, alertId, responseId } = await withResponse();
    await h.client.mutation(api.blood.updateStock, { entries: [{ bloodType: "O+", units: 6 }] });
    const result = await h.client.mutation(api.blood.confirmDonation, { responseId });
    expect(result).toEqual({ bloodType: "O+", stockBefore: 6, stockAfter: 7 });
    const alert = await t.run((ctx) => ctx.db.get(alertId));
    expect(alert?.unitsCollected).toBe(1);
    await expectAppError(h.client.mutation(api.blood.confirmDonation, { responseId }), "CONFLICT");
  });

  it("asks for the group found on site when the donor's group is unknown", async () => {
    const { h, responseId } = await withResponse(
      { bloodType: "unknown" as BloodType },
      { anyType: true, bloodTypes: [] },
    );
    await expectAppError(
      h.client.mutation(api.blood.confirmDonation, { responseId }),
      "VALIDATION",
    );
    const result = await h.client.mutation(api.blood.confirmDonation, {
      responseId,
      bloodType: "B+",
    });
    expect(result).toMatchObject({ bloodType: "B+", stockAfter: 1 });
  });

  it("never exposes donor phone, address or id to the hospital", async () => {
    const { h } = await withResponse();
    const overview = await h.client.query(api.blood.hospitalOverview, {});
    const responder = overview!.alerts[0].responders[0];
    expect(Object.keys(responder).sort()).toEqual(
      ["bloodType", "commune", "firstName", "responseId", "slotLabel", "status"].sort(),
    );
    expect(responder.firstName).toBe("Aminata");
    expect(JSON.stringify(overview)).not.toContain("+2217720");
  });

  it("validates and upserts the stock", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    await expectAppError(
      h.client.mutation(api.blood.updateStock, { entries: [{ bloodType: "O+", units: -1 }] }),
      "VALIDATION",
    );
    await expectAppError(
      h.client.mutation(api.blood.updateStock, { entries: [{ bloodType: "unknown", units: 1 }] }),
      "VALIDATION",
    );
    await h.client.mutation(api.blood.updateStock, { entries: [{ bloodType: "A-", units: 3 }] });
    await h.client.mutation(api.blood.updateStock, { entries: [{ bloodType: "A-", units: 4 }] });
    const stock = await h.client.query(api.blood.getStock, {});
    expect(stock?.entries.find((e) => e.bloodType === "A-")?.units).toBe(4);
    expect(stock?.entries).toHaveLength(8);
  });
});

describe("closing and thanks", () => {
  it("tells unconfirmed responders they need not come, but not confirmed donors", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const came = await donorCtx(t);
    const waiting = await donorCtx(t);
    const { alertId } = await sendAlert(t, h);
    for (const d of [came, waiting]) {
      await d.client.mutation(api.blood.respond, { alertId, slotStart: aSlot() });
    }
    const overview = await h.client.query(api.blood.hospitalOverview, {});
    const first = overview!.alerts[0].responders.find((r) => r.status === "pending")!;
    await h.client.mutation(api.blood.confirmDonation, { responseId: first.responseId });
    await h.client.mutation(api.blood.closeAlert, { alertId });
    await t.finishAllScheduledFunctions(() => {});

    const closedKinds = async (id: Id<"users">) =>
      (await notificationsOf(t, id)).filter((n) => n.kind === "blood_alert_closed").length;
    const counts = [await closedKinds(came.userId), await closedKinds(waiting.userId)].sort();
    expect(counts).toEqual([0, 1]);
  });

  it("sends thanks once, only to confirmed donors, and only when finished", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const came = await donorCtx(t);
    const absent = await donorCtx(t);
    const { alertId } = await sendAlert(t, h);
    await came.client.mutation(api.blood.respond, { alertId, slotStart: aSlot() });
    await absent.client.mutation(api.blood.respond, { alertId, slotStart: aSlot() });
    const overview = await h.client.query(api.blood.hospitalOverview, {});
    const cameResponse = overview!.alerts[0].responders.find((r) => r.firstName === "Aminata")!;
    await h.client.mutation(api.blood.confirmDonation, { responseId: cameResponse.responseId });

    const message = "Merci pour votre don de sang, vous sauvez des vies !";
    // Still open and below goal.
    await expectAppError(h.client.mutation(api.blood.sendThanks, { alertId, message }), "CONFLICT");
    await h.client.mutation(api.blood.closeAlert, { alertId });
    await expectAppError(
      h.client.mutation(api.blood.sendThanks, { alertId, message: "Merci" }),
      "VALIDATION",
    );
    const result = await h.client.mutation(api.blood.sendThanks, { alertId, message });
    expect(result.thanked).toBe(1);
    await expectAppError(h.client.mutation(api.blood.sendThanks, { alertId, message }), "CONFLICT");

    const thanks = async (id: Id<"users">) =>
      (await notificationsOf(t, id)).filter((n) => n.kind === "blood_thanks");
    const all = [...(await thanks(came.userId)), ...(await thanks(absent.userId))];
    expect(all).toHaveLength(1);
    expect(all[0].body).toBe(message);
  });

  it("refuses thanks when nobody's donation was confirmed", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const { alertId } = await sendAlert(t, h);
    await h.client.mutation(api.blood.closeAlert, { alertId });
    await expectAppError(
      h.client.mutation(api.blood.sendThanks, { alertId, message: "Merci beaucoup à tous" }),
      "CONFLICT",
    );
  });

  it("closes expired alerts with the hourly job once the last slot is over", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const { alertId } = await sendAlert(t, h);
    await t.run((ctx) => ctx.db.patch(alertId, { deadlineAt: Date.now() - SLOT_LENGTH_MS - 1000 }));
    await t.mutation(internal.blood.closeExpired, {});
    const alert = await t.run((ctx) => ctx.db.get(alertId));
    expect(alert?.closed).toBe(true);
    expect(alert?.closedByModerator).toBe(false);
  });

  it("does not tell a donor whose slot is still running not to come", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const donor = await donorCtx(t);
    const { alertId } = await sendAlert(t, h);
    const slotStart = aSlot();
    await donor.client.mutation(api.blood.respond, { alertId, slotStart });
    // The deadline passed 10 minutes ago, inside the donor's 2-hour slot.
    const now = slotStart + 40 * 60 * 1000;
    vi.useFakeTimers({ now, toFake: ["Date"] });
    await t.run((ctx) => ctx.db.patch(alertId, { deadlineAt: slotStart + 30 * 60 * 1000 }));
    await t.mutation(internal.blood.closeExpired, {});
    const alert = await t.run((ctx) => ctx.db.get(alertId));
    expect(alert?.closed).toBe(false);
    // No longer open to new responses, but the hospital can thank once a donation is confirmed.
    const overview = await h.client.query(api.blood.hospitalOverview, {});
    expect(overview!.alerts[0].closed).toBe(true);
    await h.client.mutation(api.blood.confirmDonation, {
      responseId: overview!.alerts[0].responders[0].responseId,
    });
    const result = await h.client.mutation(api.blood.sendThanks, {
      alertId,
      message: "Merci pour votre don de sang !",
    });
    expect(result.thanked).toBe(1);
    vi.useRealTimers();
    const closedNotes = (await notificationsOf(t, donor.userId)).filter(
      (n) => n.kind === "blood_alert_closed",
    );
    expect(closedNotes).toHaveLength(0);
  });

  it("audits responses, cancellations, confirmations and stock changes", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const came = await donorCtx(t);
    const left = await donorCtx(t, { name: "Moussa Fall" });
    const { alertId } = await sendAlert(t, h);
    await came.client.mutation(api.blood.respond, { alertId, slotStart: aSlot() });
    await left.client.mutation(api.blood.respond, { alertId, slotStart: aSlot() });
    await left.client.mutation(api.blood.cancelResponse, { alertId });
    const overview = await h.client.query(api.blood.hospitalOverview, {});
    const responder = overview!.alerts[0].responders.find((r) => r.firstName === "Aminata")!;
    await h.client.mutation(api.blood.confirmDonation, { responseId: responder.responseId });
    await h.client.mutation(api.blood.updateStock, { entries: [{ bloodType: "A+", units: 3 }] });
    const actions = await t.run(async (ctx) =>
      (await ctx.db.query("auditLog").collect()).map((a) => a.action),
    );
    for (const action of [
      "blood.respond",
      "blood.cancel",
      "blood.donation.confirm",
      "blood.stock.update",
    ]) {
      expect(actions).toContain(action);
    }
  });
});

describe("moderation", () => {
  it("requires a reason, audits, notifies the hospital and counts per hospital", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const mod = await moderatorClient(t);
    const { alertId } = await sendAlert(t, h);
    const second = await sendAlert(t, h);

    await expectAppError(
      mod.client.mutation(api.moderation.closeAlert, { alertId, reason: "  " }),
      "VALIDATION",
    );
    await expectAppError(
      h.client.mutation(api.moderation.closeAlert, { alertId, reason: "x" }),
      "FORBIDDEN",
    );
    await mod.client.mutation(api.moderation.closeAlert, { alertId, reason: "Alerte erronée" });
    await expectAppError(
      mod.client.mutation(api.moderation.closeAlert, { alertId, reason: "Encore" }),
      "CONFLICT",
    );

    const alert = await t.run((ctx) => ctx.db.get(alertId));
    expect(alert).toMatchObject({
      closed: true,
      closeReason: "Alerte erronée",
      closedByModerator: true,
    });
    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action_created", (q) => q.eq("action", "blood.alert.close"))
        .collect(),
    );
    expect(audit).toHaveLength(1);
    const note = (await notificationsOf(t, h.userId)).find((n) =>
      n.body.includes("Alerte erronée"),
    );
    expect(note?.kind).toBe("blood_alert_closed");

    const rows = await mod.client.query(api.moderation.alerts, {});
    expect(rows.map((r) => r._id)[0]).toBe(second.alertId); // open first
    expect(rows.find((r) => r._id === alertId)).toMatchObject({
      closed: true,
      hospitalModeratorClosedCount: 1,
    });
    await expectAppError(h.client.query(api.moderation.alerts, {}), "FORBIDDEN");
  });
});

describe("notifications", () => {
  it("lists the caller's notifications by kind and marks them read", async () => {
    const t = setup();
    const h = await hospitalCtx(t);
    const d = await donorCtx(t);
    await sendAlert(t, h);
    const list = await d.client.query(api.notifications.listMine, { kinds: ["blood_alert"] });
    expect(list).toHaveLength(1);
    expect(list[0].read).toBe(false);
    expect(await d.client.query(api.notifications.listMine, { kinds: ["blood_thanks"] })).toEqual(
      [],
    );
    await d.client.mutation(api.notifications.markRead, {});
    expect((await d.client.query(api.notifications.listMine, {}))[0].read).toBe(true);
  });
});
