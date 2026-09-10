// The business runs on India time. Reports slice by IST calendar month/week,
// not the server's timezone or UTC — so a stage change at 1 AM IST on the 1st
// counts in that month/week, not the last day of the previous one.
//
// IST is a fixed UTC+5:30 (no DST), so we can do the maths directly instead of
// dragging in a tz library.
export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000; // +5:30

// The UTC instant of 00:00 IST on (year, month=1-12, day).
export const istDate = (year, month, day = 1) =>
  new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - IST_OFFSET_MS);

// { $gte, $lt } window for an IST calendar month, with the end capped at "now"
// so an in-progress month doesn't include days that haven't happened yet.
export function istMonthRange(year, month) {
  const start = istDate(year, month, 1);
  const nextMonthStart = istDate(year, month + 1, 1);
  const now = new Date();
  return { $gte: start, $lt: nextMonthStart > now ? now : nextMonthStart };
}

// The whole IST calendar month, NOT capped at "now" — use when upcoming items
// in the current month should still show (e.g. scheduled Zoom meetings that
// haven't happened yet).
export const istFullMonthRange = (year, month) => ({
  $gte: istDate(year, month, 1),
  $lt: istDate(year, month + 1, 1),
});

// Mongo aggregation: which week (1-4) of the IST month a date falls in.
// Days 29-31 fold into week 4.
export const weekOfIST = (dateField) => ({
  $min: [
    4,
    { $max: [1, { $ceil: { $divide: [{ $dayOfMonth: { date: dateField, timezone: IST_TZ } }, 7] } }] },
  ],
});

// Same thing in plain JS — which week (1-4) of its IST month a Date falls in.
export const istWeekOfMonth = (date) => {
  const day = new Date(new Date(date).getTime() + IST_OFFSET_MS).getUTCDate();
  return Math.min(4, Math.max(1, Math.ceil(day / 7)));
};
