// Scheduled jobs (convex-cron-jobs). Times are UTC, which is also Senegal's time zone.

import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Receipts uploaded during signups that were never finished (convex/files.ts).
crons.daily(
  "purge abandoned signup uploads",
  { hourUTC: 3, minuteUTC: 17 },
  internal.files.purgeAbandonedUploads,
  {},
);

export default crons;
