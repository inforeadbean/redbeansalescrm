import { asyncHandler } from "../utils/asyncHandler.js";
import { scopedSalespeople, resolveScopedPerson } from "../utils/scope.js";
import { buildLeaderboard } from "../utils/leaderboard.js";
import { buildFiveForThree } from "../utils/fiveForThree.js";
import { buildCallingReport } from "../utils/callingReport.js";
import { buildFunnelReport } from "../utils/funnelReport.js";
import { buildReceivables } from "../utils/receivables.js";
import { buildPaymentDelays } from "../utils/paymentDelays.js";
import User from "../models/User.js";

// Resolve the salesperson-id set a report should cover: one person if a valid
// in-scope `?salesperson` was passed, otherwise everyone the caller manages.
async function reportScope(req) {
  const personId = await resolveScopedPerson(req.user, req.query.salesperson);
  return personId ? [personId] : await scopedSalespeople(req.user);
}

// @route GET /api/reports/five-for-three?month&year  (admin, manager)
// The one sales report: "5 for 3 (Sales Person Wise)" — planned (Pl) vs actual
// (Act) per salesperson, Week 1–4 + Month Total. Defaults to the current month.
export const getFiveForThree = asyncHandler(async (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const ids = await scopedSalespeople(req.user);
  res.json(await buildFiveForThree(ids, month, year));
});

// @route GET /api/reports/calling?month&year  (admin, manager)
// "Calling Sales Report" — actuals-only activity per salesperson for one IST
// month: calls, 1st-Zoom attendance, repeat-Zoom attendance, event attendance,
// conversions. Shown above the 5-for-3 board. Defaults to the current month.
export const getCallingReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const ids = await scopedSalespeople(req.user);
  res.json(await buildCallingReport(ids, month, year));
});

// @route GET /api/reports/leaderboard?period=month|week|all
// Company-wide for every role — a salesperson seeing where they rank against
// the whole team is the point.
export const getLeaderboard = asyncHandler(async (req, res) => {
  const period = req.query.period || "month";
  let range = {};
  if (period === "month") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    range = { from: d };
  } else if (period === "week") {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    range = { from: start };
  }

  const people = await User.find({ role: "salesperson" }).select("_id").lean();
  const rows = await buildLeaderboard(people.map((p) => p._id), range);
  res.json({ period, rows });
});

// @route GET /api/reports/funnel?from&to&salesperson   (admin, manager)
// Pipeline flow: stage-to-stage conversion, where leads stall or die, time in
// each stage, and how long lead → conversion takes. Scoped to the caller's team.
export const getFunnel = asyncHandler(async (req, res) => {
  const ids = await reportScope(req);
  res.json(await buildFunnelReport(ids, { from: req.query.from, to: req.query.to }));
});

// @route GET /api/reports/receivables?type&salesperson   (admin, manager)
// Every conversion still owing money, with aging and totals.
export const getReceivables = asyncHandler(async (req, res) => {
  const ids = await reportScope(req);
  res.json(await buildReceivables(ids, { type: req.query.type }));
});

// @route GET /api/reports/payment-delays?salesperson   (admin, manager)
// Late payments + overdue instalments, rolled up by salesperson.
export const getPaymentDelays = asyncHandler(async (req, res) => {
  const ids = await reportScope(req);
  res.json(await buildPaymentDelays(ids));
});
