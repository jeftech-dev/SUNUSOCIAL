import { expect, test } from "@playwright/test";

import { fr } from "../../lib/strings.fr";

// Donation flow with the mock payment provider (PAYMENT_PROVIDER=mock): sign in, open an active
// cause, give, "pay" in the simulator, and land on the confirmation page.
//
// Donor signup needs an SMS code (SMS_PROVIDER=console only prints it to the Convex logs), so the
// flow signs in with a donor created once by hand on the test deployment:
//   E2E_DONOR_PHONE=771234567 E2E_DONOR_PASSWORD=... npm run test:e2e
//
// The flow runs once per project and each run adds a donation, so the feed can change between
// runs. Set E2E_CAUSE_ID to an active cause with a goal far out of reach to give to that cause
// every time instead of the first one of the feed.
const phone = process.env.E2E_DONOR_PHONE;
const password = process.env.E2E_DONOR_PASSWORD;
const causeId = process.env.E2E_CAUSE_ID;

test.describe("public pages (no account needed)", () => {
  test("a signed-out visitor is sent to the login page", async ({ page }) => {
    await page.goto("/causes");
    await expect(page).toHaveURL(/\/connexion/);
    await expect(page.getByRole("button", { name: fr.auth.login.submit })).toBeVisible();
  });

  test("an unknown page shows the not-found screen", async ({ page }) => {
    await page.goto("/cette-page-n-existe-pas");
    await expect(page.getByRole("heading", { name: fr.states.notFoundTitle })).toBeVisible();
  });

  test("no page scrolls sideways", async ({ page }) => {
    for (const path of ["/", "/connexion", "/inscription", "/mot-de-passe"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("donation flow", () => {
  test.skip(!phone || !password, "set E2E_DONOR_PHONE and E2E_DONOR_PASSWORD to run");
  // Every run records a real donation on the deployment: a retry must not add another one.
  test.describe.configure({ retries: 0 });

  test("a donor gives to a cause through the simulator and sees it confirmed", async ({ page }) => {
    // Sign in.
    await page.goto("/connexion");
    await page.getByLabel(fr.auth.fields.phone, { exact: true }).fill(phone!);
    await page.getByLabel(fr.auth.fields.password, { exact: true }).fill(password!);
    await page.getByRole("button", { name: fr.auth.login.submit }).click();
    await expect(page).toHaveURL(/\/causes/);

    // Open the pinned cause, or the first one of the feed.
    if (causeId) {
      await page.goto(`/causes/${causeId}`);
    } else {
      const firstCause = page.locator('a[href^="/causes/"]').first();
      await expect(firstCause).toBeVisible({ timeout: 20_000 });
      await firstCause.click();
    }
    await expect(page).toHaveURL(/\/causes\/[^/]+$/);

    // Give with the default amount and method.
    await page.getByRole("button", { name: fr.common.donate }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The label ends with the formatted amount, so match on the part before it.
    await dialog.getByRole("button", { name: fr.donation.confirm("").trim() }).click();

    // The mock provider replaces the NabooPay page with the simulator.
    await expect(page).toHaveURL(/\/paiement\/simulation\//, { timeout: 20_000 });
    await page.getByRole("button", { name: fr.simulator.pay, exact: true }).click();

    // Back on the donation page: confirmed once the webhook is recorded.
    await expect(page).toHaveURL(/\/dons\//, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: fr.donationResult.heldTitle })).toBeVisible({
      timeout: 30_000,
    });
  });
});
