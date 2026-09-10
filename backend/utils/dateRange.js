// Turn a ?from / ?to query pair into a Mongo range filter on `field`.
// A bare date (YYYY-MM-DD) is snapped to the start / end of that day in the
// server's local time, so a range like 2026-09-01 … 2026-09-30 covers the
// whole month the way a user reading the dashboard expects it to.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function dateRangeFilter(field, from, to) {
  if (!from && !to) return {};
  const range = {};
  if (from) {
    const d = new Date(from);
    if (DATE_ONLY.test(from)) d.setHours(0, 0, 0, 0);
    range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (DATE_ONLY.test(to)) d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return { [field]: range };
}
