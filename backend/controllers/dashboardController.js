import { asyncHandler } from "../utils/asyncHandler.js";
import { leadScope, activityScope, scopedSalespeople, resolveScopedPerson } from "../utils/scope.js";
import { buildLeaderboard } from "../utils/leaderboard.js";
import Lead, { LEAD_STATUSES, LEAD_CLOSED } from "../models/Lead.js";
import Call from "../models/Call.js";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";
import IfoConversion from "../models/IfoConversion.js";
import EventBooking from "../models/EventBooking.js";
import User from "../models/User.js";
import { convertedLeadStages } from "../utils/convertedOnly.js";
import { istDate, istMonthRange } from "../utils/istTime.js";

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
