/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { DAY_MS } from "../lib/config";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("notifications.listMine", () => {
  it("lists the newest messages first, whether or not older ones were read", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Awa Diop", role: "donor", disabled: false, createdAt: 1 }),
    );
    const sessionId = await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + DAY_MS,
        mfaVerifiedAt: Date.now(),
      }),
    );
    const me = t.withIdentity({ subject: `${userId}|${sessionId}` });
    // Ten read messages, then one new unread message.
    await t.run(async (ctx) => {
      for (let i = 1; i <= 10; i++) {
        await ctx.db.insert("notifications", {
          userId,
          kind: "donation_confirmed",
          title: `Ancien ${i}`,
          body: "…",
          readAt: 5_000 + i,
          createdAt: 1_000 + i,
        });
      }
      await ctx.db.insert("notifications", {
        userId,
        kind: "donation_confirmed",
        title: "Nouveau",
        body: "…",
        createdAt: 2_000,
      });
    });

    const list = await me.query(api.notifications.listMine, {});
    expect(list[0].title).toBe("Nouveau");
    expect(list[0].read).toBe(false);
    expect(list.map((m) => m.title).slice(1, 3)).toEqual(["Ancien 10", "Ancien 9"]);
  });
});
