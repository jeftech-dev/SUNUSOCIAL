/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { isValidCommune } from "../lib/geo";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("seed:run", () => {
  afterEach(() => {
    delete process.env.APP_ENV;
  });

  it("inserts schema-valid demo data that keeps the money invariants", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(internal.seed.run, { fetchImages: false });
    expect(result).toMatchObject({ skipped: false, causes: 7 });

    await t.run(async (ctx) => {
      const donations = await ctx.db.query("donations").collect();
      expect(donations.length).toBeGreaterThan(0);
      for (const d of donations) {
        expect(d.fee + d.platformFee + d.net).toBe(d.amount);
        expect(Number.isInteger(d.amount)).toBe(true);
        expect(d.amount).toBeGreaterThanOrEqual(500);
      }

      const causes = await ctx.db.query("causes").collect();
      for (const cause of causes) {
        const own = donations.filter((d) => d.causeId === cause._id);
        expect(own.reduce((sum, d) => sum + d.amount, 0)).toBe(cause.raised);
        expect(new Set(own.map((d) => d.donorId)).size).toBe(cause.donorCount);
        for (const d of own)
          expect(d.createdAt).toBeGreaterThanOrEqual(cause.approvedAt ?? Infinity);
        expect(cause.raised).toBeLessThan(cause.goalAmount);
        expect(cause.deadline - cause.submittedAt).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
      }
      expect(causes.filter((c) => c.featuredAt !== undefined)).toHaveLength(1);

      for (const s of await ctx.db.query("structures").collect()) {
        expect(isValidCommune(s.region, s.commune)).toBe(true);
        // Hospitals never have a payout account (DT-5).
        expect(s.payout === undefined).toBe(s.type === "Hôpital (don de sang)");
      }
    });
  });

  it("is idempotent", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.seed.run, { fetchImages: false });
    const count = () => t.run(async (ctx) => (await ctx.db.query("donations").collect()).length);
    const before = await count();

    expect(await t.action(internal.seed.run, { fetchImages: false })).toEqual({ skipped: true });
    expect(await count()).toBe(before);
  });

  it("refuses to run in production", async () => {
    process.env.APP_ENV = "production";
    const t = convexTest(schema, modules);
    await expect(t.action(internal.seed.run, { fetchImages: false })).rejects.toThrow(
      /disabled in production/,
    );
  });
});
