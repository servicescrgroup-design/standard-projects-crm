/**
 * Runs once when the server starts. Vercel servers run on UTC; the team works in Thailand, so dates and
 * times rendered on the server (history, schedules, "today") use Bangkok time. Override with APP_TIME_ZONE.
 */
export function register() {
  process.env.TZ = process.env.APP_TIME_ZONE || "Asia/Bangkok";
}
