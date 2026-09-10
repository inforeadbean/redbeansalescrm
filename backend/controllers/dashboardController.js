import { asyncHandler } from "../utils/asyncHandler.js";
import { leadScope, activityScope, scopedSalespeople, resolveScopedPerson } from "../utils/scope.js";
import { buildLeaderboard } from "../utils/leaderboard.js";
import Lead, { LEAD_STATUSES, LEAD_CLOSED, LEAD_SOURCES } from "../models/Lead.js";
import Call from "../models/Call.js";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";
import IfoConversion, { CONVERSION_TYPES } from "../models/IfoConversion.js";
import EventBooking from "../models/EventBooking.js";
import User from "../models/User.js";
import { convertedLeadStages } from "../utils/convertedOnly.js";
import { istDate, istMonthRange } from "../utils/istTime.js";
import { LEAD_SOURCE_LABELS } from "../utils/labels.js";

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const weeksAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  d.setHours(0, 0, 0, 0);
  return d;
};
const sum = (agg) => agg[0]?.v || 0;

// ?month & ?year → the date window for the KPI block, on IST calendar
// boundaries. `end` is capped at now.
//   month 1-12   → that IST calendar month of ?year   (default: current month)
//   month "year" → all of ?year (IST)
//   month "all"  → all time — no date filter at all
// Returns { mode, month, year, range }; `range` is a { $gte, $lt } filter, or
// null for all-time.
function periodWindow(q) {
  const now = new Date();
  const year = parseInt(q.year, 10) || now.getFullYear();
  const key = String(q.month ?? "").toLowerCase();
  const cap = (end) => (end > now ? now : end);

  if (key === "all") return { mode: "all", year, range: null };
  if (key === "year") {
    return {
      mode: "year",
      year,
      range: { $gte: istDate(year, 1, 1), $lt: cap(istDate(year + 1, 1, 1)) },
    };
  }
  const month = parseInt(q.month, 10) || now.getMonth() + 1;
  return { mode: "month", month, year, range: istMonthRange(year, month) };
}

// @route GET /api/dashboard/summary?month&year — role-aware KPI block.
// Admin/manager: the selected month's numbers + all-time context.
// Salesperson: their rolling-30-day numbers + leaderboard rank (month filter
// ignored — their dashboard is a personal snapshot).
export const getSummary = asyncHandler(async (req, res) => {
  const personId = await resolveScopedPerson(req.user, req.query.salesperson);
  const lf = await leadScope(req.user, personId);
  const iff = await activityScope(req.user, "convertedBy", personId);
  const callF = await activityScope(req.user, "calledBy", personId);
  const bookF = await activityScope(req.user, "collectedBy", personId);

  if (req.user.role === "salesperson") {
    const win = daysAgo(30);
    const [totalLeads, converted, pipelineAgg, ifoAll, ifo30, openFollowUps, seatAgg] = await Promise.all([
      Lead.countDocuments(lf),
      Lead.countDocuments({ ...lf, status: "converted" }),
      Lead.aggregate([
        { $match: { ...lf, status: { $nin: LEAD_CLOSED } } },
        { $group: { _id: null, v: { $sum: "$potentialValue" } } },
      ]),
      IfoConversion.aggregate([{ $match: iff }, ...convertedLeadStages, { $group: { _id: null, v: { $sum: "$dealValue" }, c: { $sum: 1 } } }]),
      IfoConversion.aggregate([
        { $match: { ...iff, conversionDate: { $gte: win } } },
        ...convertedLeadStages,
        { $group: { _id: null, v: { $sum: "$dealValue" }, c: { $sum: 1 } } },
      ]),
      Lead.countDocuments({ ...lf, status: { $nin: LEAD_CLOSED }, nextFollowUpDate: { $lte: new Date() } }),
      EventBooking.aggregate([
        { $match: { ...bookF, createdAt: { $gte: win } } },
        { $group: { _id: null, v: { $sum: "$amount" }, c: { $sum: 1 } } },
      ]),
    ]);
    const peers = await scopedSalespeople({ role: "admin" });
    const board = await buildLeaderboard(peers, { from: win });
    const me = board.find((r) => r.salespersonId === String(req.user._id));
    return res.json({
      totalLeads,
      converted,
      conversionRate: totalLeads ? Math.round((converted / totalLeads) * 100) : 0,
      pipelineValue: sum(pipelineAgg),
      totalRevenue: ifoAll[0]?.v || 0,
      totalConversions: ifoAll[0]?.c || 0,
      recentRevenue: ifo30[0]?.v || 0,
      recentConversions: ifo30[0]?.c || 0,
      openFollowUps,
      seatBookings: seatAgg[0]?.v || 0,
      seatBookingCount: seatAgg[0]?.c || 0,
      myRank: me?.rank || null,
      myScore: me?.score || 0,
      teamSize: board.length,
    });
  }

  const { mode, month, year, range } = periodWindow(req.query);
  // `range` is a { $gte, $lt } window, or null for all-time (no date filter).
  const on = (field) => (range ? { [field]: range } : {});

  const [statusRows, monthLeads, meetings, ifoMonth, pipelineAgg, ifoAll, openFollowUps, seatMonth, seatAll] =
    await Promise.all([
      Lead.aggregate([
        { $match: { ...lf, ...on("createdAt") } },
        { $group: { _id: "$status", c: { $sum: 1 } } },
      ]),
      Lead.countDocuments({ ...lf, ...on("createdAt") }),
      Call.aggregate([
        { $match: { ...callF, status: "completed", ...on("completedAt") } },
        { $group: { _id: "$lead" } },
        { $count: "n" },
      ]),
      IfoConversion.aggregate([
        { $match: { ...iff, ...on("conversionDate") } },
        ...convertedLeadStages,
        {
          $group: {
            _id: null,
            v: { $sum: "$dealValue" },
            c: { $sum: 1 },
            collected: { $sum: "$amountReceived" },
            unpaid: { $sum: { $cond: [{ $lte: ["$amountReceived", 0] }, 1, 0] } },
          },
        },
      ]),
      Lead.aggregate([
        { $match: { ...lf, status: { $nin: LEAD_CLOSED } } },
        { $group: { _id: null, v: { $sum: "$potentialValue" } } },
      ]),
      IfoConversion.aggregate([
        { $match: iff },
        ...convertedLeadStages,
        {
          $group: {
            _id: null,
            v: { $sum: "$dealValue" },
            c: { $sum: 1 },
            collected: { $sum: "$amountReceived" },
            unpaid: { $sum: { $cond: [{ $lt: ["$amountReceived", "$dealValue"] }, 1, 0] } },
          },
        },
      ]),
      Lead.countDocuments({ ...lf, status: { $nin: LEAD_CLOSED }, nextFollowUpDate: { $lte: new Date() } }),
      EventBooking.aggregate([
        { $match: { ...bookF, ...on("createdAt") } },
        { $group: { _id: null, v: { $sum: "$amount" }, c: { $sum: 1 } } },
      ]),
      EventBooking.aggregate([{ $match: bookF }, { $group: { _id: null, v: { $sum: "$amount" }, c: { $sum: 1 } } }]),
    ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.c]));
  const meetingsCount = meetings[0]?.n || 0;
  const clients = ifoMonth[0]?.c || 0;
  const revenue = ifoMonth[0]?.v || 0;

  res.json({
    mode,
    month,
    year,
    statusSplit: LEAD_STATUSES.map((s) => ({ status: s, count: byStatus[s] || 0 })),
    monthLeads,
    meetings: meetingsCount,
    clients,
    clientsUnpaid: ifoMonth[0]?.unpaid || 0,
    revenue,
    collected: ifoMonth[0]?.collected || 0,
    seatBookings: seatMonth[0]?.v || 0,
    seatBookingCount: seatMonth[0]?.c || 0,
    conversionRatio: meetingsCount ? Math.round((clients / meetingsCount) * 1000) / 10 : 0,
    avgSale: clients ? Math.round(revenue / clients) : 0,
    // all-time context
    pipelineValue: sum(pipelineAgg),
    totalRevenue: ifoAll[0]?.v || 0,
    totalCollected: ifoAll[0]?.collected || 0,
    totalSeatBookings: seatAll[0]?.v || 0,
    totalSeatBookingCount: seatAll[0]?.c || 0,
    totalConversions: ifoAll[0]?.c || 0,
    totalUnpaid: ifoAll[0]?.unpaid || 0,
    openFollowUps,
  });
});

// @route GET /api/dashboard/funnel?month&year — leads CREATED in the month,
// grouped by their current stage. Salesperson: whole pipeline (no month filter).
export const getFunnel = asyncHandler(async (req, res) => {
  const personId = await resolveScopedPerson(req.user, req.query.salesperson);
  const lf = await leadScope(req.user, personId);
  const match = { ...lf };
  if (req.user.role !== "salesperson") {
    const { range } = periodWindow(req.query);
    if (range) match.createdAt = range;
  }
  const rows = await Lead.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json(LEAD_STATUSES.map((status) => ({ status, count: byStatus[status] || 0 })));
});

// @route GET /api/dashboard/trends — weekly leads + monthly conversions/revenue
export const getTrends = asyncHandler(async (req, res) => {
  const personId = await resolveScopedPerson(req.user, req.query.salesperson);
  const lf = await leadScope(req.user, personId);
  const iff = await activityScope(req.user, "convertedBy", personId);

  const [leadWeekly, convMonthly] = await Promise.all([
    Lead.aggregate([
      { $match: { ...lf, createdAt: { $gte: weeksAgo(8) } } },
      {
        $group: {
          _id: { $dateTrunc: { date: "$createdAt", unit: "week", startOfWeek: "monday" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    IfoConversion.aggregate([
      { $match: { ...iff, conversionDate: { $gte: monthsAgo(5) } } },
      ...convertedLeadStages,
      {
        $group: {
          _id: { $dateTrunc: { date: "$conversionDate", unit: "month" } },
          conversions: { $sum: 1 },
          revenue: { $sum: "$dealValue" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    leadsWeekly: leadWeekly.map((r) => ({ week: r._id, count: r.count })),
    conversionsMonthly: convMonthly.map((r) => ({
      month: r._id,
      conversions: r.conversions,
      revenue: r.revenue,
    })),
  });
});

// @route GET /api/dashboard/my-tasks — the caller's action list for today
export const getMyTasks = asyncHandler(async (req, res) => {
  const lf = await leadScope(req.user);
  const callBase =
    req.user.role === "salesperson"
      ? { calledBy: req.user._id }
      : await activityScope(req.user, "calledBy");

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [followUps, callsToday, overdueCalls, upcomingWebinars, upcomingEvents] = await Promise.all([
    Lead.find({ ...lf, status: { $nin: LEAD_CLOSED }, nextFollowUpDate: { $lte: todayEnd } })
      .sort("nextFollowUpDate")
      .limit(20)
      .select("name restaurantName phone status nextFollowUpDate")
      .lean(),
    Call.countDocuments({ ...callBase, status: "scheduled", scheduledAt: { $lte: todayEnd, $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Call.countDocuments({ ...callBase, status: "scheduled", scheduledAt: { $lt: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Webinar.find({ status: "upcoming", scheduledAt: { $gte: new Date() } }).sort("scheduledAt").limit(3).select("title scheduledAt").lean(),
    Event.find({ status: "upcoming", date: { $gte: new Date() } }).sort("date").limit(3).select("title date city").lean(),
  ]);

  res.json({ followUps, callsToday, overdueCalls, upcomingWebinars, upcomingEvents });
});

// @route GET /api/dashboard/team-pipeline — every salesperson in scope with a
// count of their leads at each current stage. (admin: everyone, manager: team.)
export const getTeamPipeline = asyncHandler(async (req, res) => {
  const ids = await scopedSalespeople(req.user);
  if (!ids.length) return res.json({ rows: [] });

  const [people, agg] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("name").sort("name").lean(),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids } } },
      { $group: { _id: { sp: "$assignedTo", s: "$status" }, c: { $sum: 1 } } },
    ]),
  ]);

  const byPerson = {};
  for (const r of agg) {
    const k = String(r._id.sp);
    (byPerson[k] ||= {})[r._id.s] = r.c;
  }

  res.json({
    statuses: LEAD_STATUSES,
    rows: people.map((p) => {
      const byStatus = byPerson[String(p._id)] || {};
      return {
        salespersonId: String(p._id),
        name: p.name,
        byStatus,
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        open: LEAD_STATUSES.filter((s) => !LEAD_CLOSED.includes(s)).reduce(
          (a, s) => a + (byStatus[s] || 0),
          0
        ),
      };
    }),
  });
});

// @route GET /api/dashboard/insights?month&year&salesperson — extra KPIs for
// the admin/manager dashboard: where leads come from and how well each
// source converts, the IFO/RBC revenue split, money still owed (all-time —
// receivables don't reset month to month), Zoom/event turnout, call activity,
// and two "how good is the sales motion" numbers (average deal size, average
// days from a lead's first contact to it closing). Same role scoping as the
// rest of this file (admin/manager only — see the route).
export const getInsights = asyncHandler(async (req, res) => {
  const personId = await resolveScopedPerson(req.user, req.query.salesperson);
  const lf = await leadScope(req.user, personId);
  const iff = await activityScope(req.user, "convertedBy", personId);
  const callF = await activityScope(req.user, "calledBy", personId);
  const { range } = periodWindow(req.query);
  const on = (field) => (range ? { [field]: range } : {});
  // Webinar/Event registrations aren't role-scoped collections themselves
  // (every user sees the same sessions) — scope the *lead* side of the join
  // instead, mirroring whatever leadScope resolved to.
  const leadMatch = (prefix) =>
    lf.assignedTo ? { [`${prefix}.assignedTo`]: lf.assignedTo } : {};

  // How many DISTINCT Zoom meetings a lead currently sitting at "Zoom 1
  // Attended" has actually attended — 1 is the normal case, 2+ means they
  // were put on a re-run because they didn't get the topic the first time
  // (the "needed a second Zoom" flow on the lead page). Same createdAt
  // window as the funnel above, so the two stay comparable.
  const zoomDepthMatch = { "lead.status": "webinar_attended", ...leadMatch("lead") };
  if (range) zoomDepthMatch["lead.createdAt"] = range;

  const [sourceAgg, revenueMixAgg, receivablesAgg, zoomAgg, eventAgg, callAgg, cycleAgg, zoomDepthAgg, atZoomAttendedCount] =
    await Promise.all([
      Lead.aggregate([
        { $match: { ...lf, ...on("createdAt") } },
        {
          $group: {
            _id: "$source",
            leads: { $sum: 1 },
            converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          },
        },
      ]),
      IfoConversion.aggregate([
        { $match: { ...iff, ...on("conversionDate") } },
        ...convertedLeadStages,
        { $group: { _id: "$conversionType", count: { $sum: 1 }, revenue: { $sum: "$dealValue" } } },
      ]),
      IfoConversion.aggregate([
        { $match: iff },
        ...convertedLeadStages,
        {
          $group: {
            _id: null,
            totalDeal: { $sum: "$dealValue" },
            totalCollected: { $sum: "$amountReceived" },
            clientsWithDues: { $sum: { $cond: [{ $lt: ["$amountReceived", "$dealValue"] }, 1, 0] } },
          },
        },
      ]),
      Webinar.aggregate([
        { $match: on("scheduledAt") },
        { $unwind: "$registrations" },
        { $lookup: { from: "leads", localField: "registrations.lead", foreignField: "_id", as: "lead" } },
        { $unwind: "$lead" },
        { $match: leadMatch("lead") },
        {
          $group: {
            _id: null,
            registered: { $sum: 1 },
            attended: { $sum: { $cond: ["$registrations.attended", 1, 0] } },
          },
        },
      ]),
      Event.aggregate([
        { $match: on("date") },
        { $unwind: "$invitees" },
        { $lookup: { from: "leads", localField: "invitees.lead", foreignField: "_id", as: "lead" } },
        { $unwind: "$lead" },
        { $match: leadMatch("lead") },
        {
          $group: {
            _id: null,
            invited: { $sum: 1 },
            attended: { $sum: { $cond: ["$invitees.attended", 1, 0] } },
          },
        },
      ]),
      Call.aggregate([
        { $match: { ...callF, ...on("scheduledAt") } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            missed: { $sum: { $cond: [{ $eq: ["$status", "missed"] }, 1, 0] } },
            connected: { $sum: { $cond: [{ $eq: ["$outcome", "connected"] }, 1, 0] } },
          },
        },
      ]),
      IfoConversion.aggregate([
        { $match: { ...iff, ...on("conversionDate") } },
        { $lookup: { from: "leads", localField: "lead", foreignField: "_id", as: "_lead" } },
        { $unwind: "$_lead" },
        { $match: { "_lead.status": "converted" } },
        { $project: { days: { $divide: [{ $subtract: ["$conversionDate", "$_lead.createdAt"] }, 86400000] } } },
        { $group: { _id: null, avgDays: { $avg: "$days" }, n: { $sum: 1 } } },
      ]),
      Webinar.aggregate([
        { $unwind: "$registrations" },
        { $match: { "registrations.attended": true } },
        { $group: { _id: "$registrations.lead", zoomCount: { $sum: 1 } } },
        { $lookup: { from: "leads", localField: "_id", foreignField: "_id", as: "lead" } },
        { $unwind: "$lead" },
        { $match: zoomDepthMatch },
        { $group: { _id: "$zoomCount", leads: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Lead.countDocuments({ ...lf, ...on("createdAt"), status: "webinar_attended" }),
    ]);

  const bySource = Object.fromEntries(sourceAgg.map((r) => [r._id, r]));
  const sourcePerformance = LEAD_SOURCES.map((s) => {
    const row = bySource[s];
    const leads = row?.leads || 0;
    const converted = row?.converted || 0;
    return {
      source: s,
      label: LEAD_SOURCE_LABELS[s] || s,
      leads,
      converted,
      conversionRate: leads ? Math.round((converted / leads) * 1000) / 10 : 0,
    };
  }).filter((r) => r.leads > 0);

  const byType = Object.fromEntries(revenueMixAgg.map((r) => [r._id, r]));
  const revenueMix = CONVERSION_TYPES.map((t) => ({
    type: t,
    label: t.toUpperCase(),
    count: byType[t]?.count || 0,
    revenue: byType[t]?.revenue || 0,
  }));

  const rec = receivablesAgg[0] || {};
  const zoom = zoomAgg[0] || {};
  const event = eventAgg[0] || {};
  const calls = callAgg[0] || {};
  const cycle = cycleAgg[0] || {};

  const dealCount = revenueMixAgg.reduce((a, r) => a + r.count, 0);
  const dealRevenue = revenueMixAgg.reduce((a, r) => a + r.revenue, 0);

  // Bucket into 1 / 2 / 3+ Zoom meetings attended — anything past 3 is rare
  // enough that a longer tail would just clutter the chart. Some leads reach
  // "Zoom 1 Attended" by a direct manual stage move rather than a ticked
  // registration (no Webinar record at all) — counted as "0" so the buckets
  // add up to the same total the funnel shows for this stage.
  const zoomDepthBuckets = { 0: 0, 1: 0, 2: 0, "3+": 0 };
  for (const r of zoomDepthAgg) {
    const key = r._id >= 3 ? "3+" : String(r._id);
    if (key in zoomDepthBuckets) zoomDepthBuckets[key] += r.leads;
  }
  zoomDepthBuckets["0"] = Math.max(
    0,
    atZoomAttendedCount - (zoomDepthBuckets["1"] + zoomDepthBuckets["2"] + zoomDepthBuckets["3+"])
  );

  res.json({
    sourcePerformance,
    revenueMix,
    avgDealSize: dealCount ? Math.round(dealRevenue / dealCount) : 0,
    collections: {
      totalDeal: rec.totalDeal || 0,
      totalCollected: rec.totalCollected || 0,
      totalOutstanding: Math.max(0, (rec.totalDeal || 0) - (rec.totalCollected || 0)),
      pctCollected: rec.totalDeal ? Math.round((rec.totalCollected / rec.totalDeal) * 100) : 0,
      clientsWithDues: rec.clientsWithDues || 0,
    },
    attendance: {
      zoomRegistered: zoom.registered || 0,
      zoomAttended: zoom.attended || 0,
      zoomRate: zoom.registered ? Math.round((zoom.attended / zoom.registered) * 100) : 0,
      eventInvited: event.invited || 0,
      eventAttended: event.attended || 0,
      eventRate: event.invited ? Math.round((event.attended / event.invited) * 100) : 0,
    },
    calls: {
      total: calls.total || 0,
      completed: calls.completed || 0,
      missed: calls.missed || 0,
      connected: calls.connected || 0,
      connectRate: calls.completed ? Math.round((calls.connected / calls.completed) * 100) : 0,
    },
    avgSalesCycleDays: cycle.n ? Math.round(cycle.avgDays) : null,
    zoomAttendanceDepth: [
      { label: "Attended 1 Zoom", leads: zoomDepthBuckets["1"] },
      { label: "Attended 2 Zooms", leads: zoomDepthBuckets["2"] },
      { label: "Attended 3+ Zooms", leads: zoomDepthBuckets["3+"] },
      { label: "No Zoom on record (moved manually)", leads: zoomDepthBuckets["0"] },
    ],
  });
});
