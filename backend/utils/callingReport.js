import mongoose from "mongoose";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";
import IfoConversion from "../models/IfoConversion.js";
import Lead from "../models/Lead.js";
import User from "../models/User.js";
import { istMonthRange, istFullMonthRange, istWeekOfMonth, weekOfIST } from "./istTime.js";

// The "Calling Sales Report" — Week 1-4 + Month Total, one sub-row per
// salesperson (like the 5-for-3 board), ACTUALS ONLY. A funnel off the month's
// Zoom meetings:
//
//   Leads      leads they added — bucketed by the week they were added
//   Called     of those, how many have since left the "New" stage
//              (contacted). No call-log is in use; leaving "New" is the signal.
//   <col per non-cancelled Zoom meeting this month>  = how many of their leads
//              attended it. A meeting runs on one date, so its number sits in
//              that meeting's week (0 elsewhere).
//   <col per non-cancelled Event this month>  = of the Zoom attendees, how many
//              also attended that event (in the event's week).
//   Converted  of the Zoom attendees, how many converted — in the week the
//              conversion was booked. Column hidden until someone converts.
//
// "Zoom attendees" (the cohort) = every lead who attended ≥1 of this month's
// Zoom meetings. Everything is credited to the lead's current owner.

const oid = (id) => new mongoose.Types.ObjectId(id);
const WEEKS = [1, 2, 3, 4];

export async function buildCallingReport(salespersonIds, month, year) {
  const ids = salespersonIds.map(oid);
  const inMonth = istMonthRange(year, month); // capped at now — leads / conversions
  const fullMonth = istFullMonthRange(year, month); // whole month — meeting / event lists

  const [people, leadRows, monthWebinars, monthEvents] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("name").sort("name").lean(),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, createdAt: inMonth } },
      {
        $group: {
          _id: { sp: "$assignedTo", w: weekOfIST("$createdAt") },
          c: { $sum: 1 },
          called: { $sum: { $cond: [{ $ne: ["$status", "new"] }, 1, 0] } },
        },
      },
    ]),
    Webinar.find({ scheduledAt: fullMonth, status: { $ne: "cancelled" } })
      .select("title scheduledAt registrations")
      .sort("scheduledAt")
      .lean(),
    Event.find({ date: fullMonth, status: { $ne: "cancelled" } })
      .select("title date invitees")
      .sort("date")
      .lean(),
  ]);

  // Cohort = every lead who attended ≥1 of this month's Zoom meetings.
  const cohort = new Set();
  for (const w of monthWebinars)
    for (const r of w.registrations) if (r.attended) cohort.add(String(r.lead));

  const [cohortLeads, cohortConvs] = await Promise.all([
    Lead.find({ _id: { $in: [...cohort] }, assignedTo: { $in: ids } })
      .select("assignedTo")
      .lean(),
    IfoConversion.find({ lead: { $in: [...cohort] }, conversionDate: inMonth })
      .select("lead conversionDate")
      .lean(),
  ]);
  const ownerOf = Object.fromEntries(cohortLeads.map((l) => [String(l._id), String(l.assignedTo)]));

  // Per-meeting attendance, credited to the lead's owner.
  const attBy = {};
  for (const w of monthWebinars) {
    const wid = String(w._id);
    attBy[wid] = {};
    for (const r of w.registrations) {
      if (!r.attended) continue;
      const owner = ownerOf[String(r.lead)];
      if (owner) attBy[wid][owner] = (attBy[wid][owner] || 0) + 1;
    }
  }

  // Per-event attendance — cohort leads only.
  const evtAttBy = {};
  for (const e of monthEvents) {
    const eid = String(e._id);
    evtAttBy[eid] = {};
    for (const i of e.invitees) {
      if (!i.attended || !cohort.has(String(i.lead))) continue;
      const owner = ownerOf[String(i.lead)];
      if (owner) evtAttBy[eid][owner] = (evtAttBy[eid][owner] || 0) + 1;
    }
  }

  // Conversions by (owner, week).
  const convBy = {}; // `${sp}:${w}` -> count
  for (const c of cohortConvs) {
    const owner = ownerOf[String(c.lead)];
    if (!owner) continue;
    const w = istWeekOfMonth(c.conversionDate);
    convBy[`${owner}:${w}`] = (convBy[`${owner}:${w}`] || 0) + 1;
  }

  const leadsBy = Object.fromEntries(leadRows.map((r) => [`${r._id.sp}:${r._id.w}`, r]));

  const meetings = monthWebinars.map((w) => ({
    webinarId: String(w._id),
    title: w.title,
    scheduledAt: w.scheduledAt,
    week: istWeekOfMonth(w.scheduledAt),
  }));
  const events = monthEvents.map((e) => ({
    eventId: String(e._id),
    title: e.title,
    date: e.date,
    week: istWeekOfMonth(e.date),
  }));

  // one salesperson's numbers for week `w` (1-4), or the whole month (w = 0)
  const cell = (spId, w) => {
    const weeks = w === 0 ? WEEKS : [w];
    const lk = weeks.reduce(
      (a, wk) => {
        const r = leadsBy[`${spId}:${wk}`];
        return r ? { c: a.c + r.c, called: a.called + r.called } : a;
      },
      { c: 0, called: 0 }
    );
    const zooms = {};
    for (const m of meetings)
      zooms[m.webinarId] = weeks.includes(m.week) ? attBy[m.webinarId]?.[spId] || 0 : 0;
    const evts = {};
    for (const e of events)
      evts[e.eventId] = weeks.includes(e.week) ? evtAttBy[e.eventId]?.[spId] || 0 : 0;
    const converted = weeks.reduce((a, wk) => a + (convBy[`${spId}:${wk}`] || 0), 0);
    return { leads: lk.c, called: lk.called, zooms, events: evts, converted };
  };

  const sumCells = (cells) => ({
    leads: cells.reduce((a, c) => a + c.leads, 0),
    called: cells.reduce((a, c) => a + c.called, 0),
    converted: cells.reduce((a, c) => a + c.converted, 0),
    zooms: Object.fromEntries(
      meetings.map((m) => [m.webinarId, cells.reduce((a, c) => a + c.zooms[m.webinarId], 0)])
    ),
    events: Object.fromEntries(
      events.map((e) => [e.eventId, cells.reduce((a, c) => a + c.events[e.eventId], 0)])
    ),
  });

  const section = (w) => {
    const rows = people.map((p) => ({
      salespersonId: String(p._id),
      name: p.name,
      ...cell(String(p._id), w),
    }));
    return { rows, total: sumCells(rows.map(({ salespersonId, name, ...rest }) => rest)) };
  };

  const monthTotal = section(0);

  return {
    month,
    year,
    meetings,
    events,
    showConverted: monthTotal.total.converted > 0,
    weeks: WEEKS.map((w) => ({ label: `Week ${w}`, week: w, ...section(w) })),
    monthTotal: { label: "Month Total", ...monthTotal },
  };
}
