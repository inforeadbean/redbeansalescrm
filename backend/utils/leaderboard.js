import Lead from "../models/Lead.js";
import Call from "../models/Call.js";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";
import IfoConversion from "../models/IfoConversion.js";
import User from "../models/User.js";
import { computeScore, assignBadges } from "./score.js";
import { convertedLeadStages } from "./convertedOnly.js";

// Builds the ranked activity table used by BOTH the Leaderboard report and
// the sales dashboard's "your rank". Aggregates each salesperson's activity
// inside the optional [from, to] window, scores it, sorts, and tags badges.
//
// Webinar/event turnout is credited to the salesperson who owns the attending
// lead (their pipeline work is what filled the room), so those need a lead →
// owner lookup rather than a plain aggregation.
export async function buildLeaderboard(salespersonIds, { from, to } = {}) {
  const dateFilter = (field) => {
    const r = {};
    if (from) r.$gte = from;
    if (to) r.$lte = to;
    return Object.keys(r).length ? { [field]: r } : {};
  };
  const ids = salespersonIds;

  const [people, leadRows, callRows, ifoRows, webinars, events] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("name photoUrl").lean(),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, ...dateFilter("createdAt") } },
      { $group: { _id: "$assignedTo", c: { $sum: 1 } } },
    ]),
    Call.aggregate([
      { $match: { calledBy: { $in: ids }, status: "completed", ...dateFilter("completedAt") } },
      { $group: { _id: "$calledBy", c: { $sum: 1 } } },
    ]),
    IfoConversion.aggregate([
      { $match: { convertedBy: { $in: ids }, ...dateFilter("conversionDate") } },
      ...convertedLeadStages,
      { $group: { _id: "$convertedBy", c: { $sum: 1 }, revenue: { $sum: "$dealValue" } } },
    ]),
    Webinar.find(dateFilter("scheduledAt")).select("registrations").lean(),
    Event.find(dateFilter("date")).select("invitees").lean(),
  ]);

  const attendedLeadIds = [
    ...webinars.flatMap((w) => w.registrations.filter((r) => r.attended).map((r) => r.lead)),
    ...events.flatMap((e) => e.invitees.filter((i) => i.attended).map((i) => i.lead)),
  ];
  const owners = await Lead.find({ _id: { $in: attendedLeadIds } })
    .select("assignedTo")
    .lean();
  const ownerOf = Object.fromEntries(owners.map((l) => [String(l._id), String(l.assignedTo)]));

  const webAtt = {};
  const evtAtt = {};
  for (const w of webinars)
    for (const r of w.registrations)
      if (r.attended) {
        const o = ownerOf[String(r.lead)];
        if (o) webAtt[o] = (webAtt[o] || 0) + 1;
      }
  for (const e of events)
    for (const i of e.invitees)
      if (i.attended) {
        const o = ownerOf[String(i.lead)];
        if (o) evtAtt[o] = (evtAtt[o] || 0) + 1;
      }

  const map = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r]));
  const leadsBy = map(leadRows);
  const callsBy = map(callRows);
  const ifoBy = map(ifoRows);

  let rows = people.map((p) => {
    const id = String(p._id);
    const counts = {
      leadsAdded: leadsBy[id]?.c || 0,
      callsCompleted: callsBy[id]?.c || 0,
      webinarAttendees: webAtt[id] || 0,
      eventAttendees: evtAtt[id] || 0,
      conversions: ifoBy[id]?.c || 0,
      revenue: ifoBy[id]?.revenue || 0,
    };
    return {
      salespersonId: id,
      name: p.name,
      photoUrl: p.photoUrl,
      ...counts,
      score: computeScore(counts),
    };
  });

  rows.sort((a, b) => b.score - a.score || b.revenue - a.revenue);
  const badges = assignBadges(rows);
  rows = rows.map((r, i) => ({ ...r, rank: i + 1, badges: badges[r.salespersonId] || [] }));
  return rows;
}
