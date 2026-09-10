// The weighted activity score behind the Leaderboard and the sales
// dashboard's "your rank". Every action a salesperson can take is worth a
// fixed number of points; revenue converts at ₹1,000 = 1 point. Tuned so a
// single IFO conversion (25) outweighs a busy week of calls, but sustained
// pipeline work still moves the needle.
export const SCORE_WEIGHTS = {
  lead: 1,
  call: 2,
  webinarAttendee: 3,
  eventAttendee: 4,
  conversion: 25,
  revenuePerPoint: 1000,
};

export function computeScore({
  leadsAdded = 0,
  callsCompleted = 0,
  webinarAttendees = 0,
  eventAttendees = 0,
  conversions = 0,
  revenue = 0,
} = {}) {
  return (
    leadsAdded * SCORE_WEIGHTS.lead +
    callsCompleted * SCORE_WEIGHTS.call +
    webinarAttendees * SCORE_WEIGHTS.webinarAttendee +
    eventAttendees * SCORE_WEIGHTS.eventAttendee +
    conversions * SCORE_WEIGHTS.conversion +
    Math.round(revenue / SCORE_WEIGHTS.revenuePerPoint)
  );
}

// Given the already-ranked rows (each with the raw counts above), decide who
// gets which badge. Returns a map of salespersonId -> [badge slugs].
export function assignBadges(rows) {
  const badges = {};
  const add = (id, slug) => {
    if (!id) return;
    badges[id] = badges[id] || [];
    if (!badges[id].includes(slug)) badges[id].push(slug);
  };
  const top = (key) =>
    rows.reduce((best, r) => (r[key] > (best?.[key] ?? -1) ? r : best), null);

  if (rows.length) {
    add(rows[0].salespersonId, "top_scorer");
    const closer = top("conversions");
    if (closer?.conversions > 0) add(closer.salespersonId, "top_closer");
    const caller = top("callsCompleted");
    if (caller?.callsCompleted > 0) add(caller.salespersonId, "call_champion");
    const earner = top("revenue");
    if (earner?.revenue > 0) add(earner.salespersonId, "revenue_king");
  }
  return badges;
}
