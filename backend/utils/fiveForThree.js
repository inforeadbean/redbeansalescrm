import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import IfoConversion from "../models/IfoConversion.js";
import Target from "../models/Target.js";
import User from "../models/User.js";
import { convertedLeadStages } from "./convertedOnly.js";
import { istMonthRange, weekOfIST } from "./istTime.js";

// The "5 for 3 (Sales Person Wise)" board — planned vs actual straight down the
// lead pipeline, one row per salesperson, Week 1–4 + a Month Total.
//
//   No of Leads         Pl = lead target ÷ 4            Act = leads created that week
//   Zoom Candidates     Pl = # reached "Interested for Zoom 1"   Act = # reached "Zoom 1 Attended"
//   Event Candidates    Pl = # reached "Interested for event"    Act = # reached "Event attended"
//   No of Clients       Pl = # reached "Interested for course"   Act = conversions booked (IFO/RBC)
//   Conversion Ratio    Act = clients ÷ leads                     (no plan)
//   Avg ₹ Sale          Pl = revenue target ÷ conv. target  Act = revenue ÷ clients
//   Revenue             Pl = revenue target ÷ 4          Act = Σ deal value
//
// This is a CUMULATIVE FUNNEL. The Webinar/Event/Clients counts read off a
// lead's `statusHistory`: a lead is counted once in EVERY stage it genuinely
// passed through, in the week it crossed that line (first crossing if it bounced
// back and forth). A lead that skipped a stage (e.g. straight to "event
// interested" with no webinar) is NOT counted for the skipped stage. So the
// month totals form a real funnel and you can see where leads drop off.

const oid = (id) => new mongoose.Types.ObjectId(id);
const weekOf = weekOfIST; // IST calendar week (1-4)
const round = (n) => Math.round(n || 0);
const ratio = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0); // one decimal %

// Each of these lead statuses is one half of a report column.
const STAGE_STATUSES = [
  "webinar_interested",
  "webinar_attended",
  "event_interested",
  "event_attended",
  "course_interested",
];

export async function buildFiveForThree(salespersonIds, month, year) {
  const ids = salespersonIds.map((i) => oid(i));
  const inMonth = istMonthRange(year, month); // { $gte, $lt } — IST month, capped at now

  const [people, targets, leadRows, stageRows, ifoRows] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("name").sort("name").lean(),
    Target.find({ salesperson: { $in: ids }, month, year }).lean(),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, createdAt: inMonth } },
      { $group: { _id: { sp: "$assignedTo", w: weekOf("$createdAt") }, c: { $sum: 1 } } },
    ]),
    // Cumulative funnel: unwind each lead's stage history, keep the crossings
    // into a report stage that happened this month, dedupe to one row per
    // (lead, stage) at its FIRST week, then tally by (salesperson, week, stage).
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, "statusHistory.status": { $in: STAGE_STATUSES } } },
      { $unwind: "$statusHistory" },
      { $match: { "statusHistory.status": { $in: STAGE_STATUSES }, "statusHistory.at": inMonth } },
      {
        $group: {
          _id: { lead: "$_id", sp: "$assignedTo", s: "$statusHistory.status" },
          w: { $min: weekOf("$statusHistory.at") },
        },
      },
      { $group: { _id: { sp: "$_id.sp", w: "$w", s: "$_id.s" }, c: { $sum: 1 } } },
    ]),
    IfoConversion.aggregate([
      { $match: { convertedBy: { $in: ids }, conversionDate: inMonth } },
      ...convertedLeadStages,
      { $group: { _id: { sp: "$convertedBy", w: weekOf("$conversionDate") }, c: { $sum: 1 }, rev: { $sum: "$dealValue" } } },
    ]),
  ]);

  const leadsBy = Object.fromEntries(leadRows.map((r) => [`${r._id.sp}:${r._id.w}`, r.c]));
  const stageBy = Object.fromEntries(stageRows.map((r) => [`${r._id.sp}:${r._id.w}:${r._id.s}`, r.c]));
  const ifoBy = Object.fromEntries(ifoRows.map((r) => [`${r._id.sp}:${r._id.w}`, r]));
  const tgtBy = Object.fromEntries(targets.map((t) => [String(t.salesperson), t]));

  // one salesperson's numbers for one week (w = 1..4) or the whole month (w = 0)
  const cell = (spId, w) => {
    const t = tgtBy[String(spId)] || {};
    const div = w === 0 ? 1 : 4;
    const weeks = w === 0 ? [1, 2, 3, 4] : [w];
    const stage = (s) => weeks.reduce((a, wk) => a + (stageBy[`${spId}:${wk}:${s}`] || 0), 0);

    const actLeads = weeks.reduce((a, wk) => a + (leadsBy[`${spId}:${wk}`] || 0), 0);
    const actClients = weeks.reduce((a, wk) => a + (ifoBy[`${spId}:${wk}`]?.c || 0), 0);
    const actRev = weeks.reduce((a, wk) => a + (ifoBy[`${spId}:${wk}`]?.rev || 0), 0);

    const webinar = { pl: stage("webinar_interested"), act: stage("webinar_attended") };
    const event = { pl: stage("event_interested"), act: stage("event_attended") };
    const clients = { pl: stage("course_interested"), act: actClients };

    return {
      leads: { pl: round((t.leadTarget || 0) / div), act: actLeads },
      webinar,
      event,
      clients,
      // Close rate on leads: clients ÷ leads. Pl = the planned rate from targets.
      conversionRatio: {
        pl: ratio(t.conversionTarget || 0, t.leadTarget || 0),
        act: ratio(actClients, actLeads),
      },
      avgSale: {
        pl: round((t.revenueTarget || 0) / (t.conversionTarget || 1)),
        act: clients.act ? round(actRev / clients.act) : 0,
      },
      revenue: { pl: round((t.revenueTarget || 0) / div), act: actRev },
    };
  };

  const sumCells = (cells) => {
    const s = (m, f) => cells.reduce((a, c) => a + (c[m][f] || 0), 0);
    const t = {
      leads: { pl: s("leads", "pl"), act: s("leads", "act") },
      webinar: { pl: s("webinar", "pl"), act: s("webinar", "act") },
      event: { pl: s("event", "pl"), act: s("event", "act") },
      clients: { pl: s("clients", "pl"), act: s("clients", "act") },
      revenue: { pl: s("revenue", "pl"), act: s("revenue", "act") },
    };
    t.conversionRatio = { pl: 0, act: ratio(t.clients.act, t.leads.act) };
    t.avgSale = { pl: 0, act: t.clients.act ? round(t.revenue.act / t.clients.act) : 0 };
    return t;
  };

  const section = (w) => {
    const rows = people.map((p) => ({ salespersonId: String(p._id), name: p.name, ...cell(p._id, w) }));
    const total = sumCells(rows.map(({ salespersonId, name, ...rest }) => rest));
    // Group plan ratios/averages come from the summed targets, not the summed
    // cells (an average of averages / ratio of ratios would be wrong).
    const sumT = (f) => people.reduce((a, p) => a + (tgtBy[String(p._id)]?.[f] || 0), 0);
    const revT = sumT("revenueTarget");
    const convT = sumT("conversionTarget");
    const leadT = sumT("leadTarget");
    total.avgSale.pl = convT ? round(revT / convT) : 0;
    total.conversionRatio.pl = ratio(convT, leadT);
    return { rows, total };
  };

  return {
    month,
    year,
    weeks: [1, 2, 3, 4].map((w) => ({ label: `Week ${w}`, week: w, ...section(w) })),
    monthTotal: { label: "Month Total", ...section(0) },
    columns: ["leads", "webinar", "event", "clients", "conversionRatio", "avgSale", "revenue"],
  };
}
