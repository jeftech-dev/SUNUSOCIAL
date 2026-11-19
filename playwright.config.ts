import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

// The app talks to a real (non-production) Convex deployment: set NEXT_PUBLIC_CONVEX_URL in
// `.env.local` and run Convex with PAYMENT_PROVIDER=mock and SMS_PROVIDER=console.
// `E2E_BROWSER_CHANNEL=chrome` reuses an installed Chrome instead of Playwright's own Chromium.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "fr-FR",
  },
  projects: [
    {
      name: "mobile-375",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.E2E_BROWSER_CHANNEL,
        viewport: { width: 375, height: 800 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.E2E_BROWSER_CHANNEL,
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
