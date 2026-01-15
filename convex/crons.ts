import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Ecwid Auto-Sync Cron Job
 * Runs every hour and checks if auto-sync is enabled and enough time has passed
 */
crons.interval(
    "ecwid-auto-sync",
    { hours: 1 }, // Check every hour
    internal.ecwidCron.checkAndSync
);

export default crons;
