import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import User from "../models/User.js";
import Lead, { LEAD_SOURCES } from "../models/Lead.js";
import Remark from "../models/Remark.js";
import Call, { CALL_OUTCOMES } from "../models/Call.js";
import Webinar from "../models/Webinar.js";
import Event from "../models/Event.js";
import IfoConversion, { CONVERSION_DEFAULT_VALUE } from "../models/IfoConversion.js";
import Target from "../models/Target.js";
import { seedAdmin } from "./seedAdmin.js";
import { seedBase } from "./seedBase.js";

// Populates every module with realistic, referentially-consistent demo data so
// dashboards, charts and reports are immediately meaningful. Assumes an open
// Mongoose connection (the caller owns connect/disconnect). Re-runnable —
// wipes all non-admin data first.
//
// The core idea: activity is generated PER SALESPERSON PER MONTH as a fraction
// of that person's target (`attain`, ~0.5–1.15, fixed per person/month), so
// the Weekly and Monthly reports show a real red/amber/green spread instead of
// a wall of one colour. Cohorts cover this month so far, the last two full
// months, and a bank of older leads for funnel depth.

const CITIES = [
  ["Mumbai", "MH"], ["Pune", "MH"], ["Delhi", "DL"], ["Gurugram", "HR"],
  ["Bengaluru", "KA"], ["Hyderabad", "TS"], ["Chennai", "TN"], ["Kolkata", "WB"],
  ["Ahmedabad", "GJ"], ["Jaipur", "RJ"], ["Indore", "MP"], ["Lucknow", "UP"],
];
const BRAND_WORDS = [
  "Spice", "Tandoor", "Curry", "Biryani", "Chaat", "Dosa", "Thali", "Masala",
  "Kitchen", "Grill", "Bowl", "Corner", "House", "Junction", "Express", "Cafe",
];
const NOTE_LINES = [
  "Left a voicemail, will retry tomorrow.",
  "Owner interested, sent pricing over WhatsApp.",
  "Asked for a callback next week.",
  "Discussed kitchen capacity and delivery radius.",
  "Shared a case study of a similar outlet.",
  "Following up after the Zoom meeting.",
];

const rand = (a) => faker.helpers.arrayElement(a);
const brand = () => `${rand(BRAND_WORDS)} ${rand(BRAND_WORDS)}`;
const phone = () => "9" + faker.string.numeric(9);
const between = (from, to) => faker.date.between({ from, to: to > from ? to : from });
const cityState = () => {
  const [city, state] = rand(CITIES);
  return { city, state };
};

const NOW = new Date();
const monthStart = (back) => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - back, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const monthEnd = (back) => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - back + 1, 0, 23, 59, 59, 999);
  return d > NOW ? NOW : d;
};

// Mid-funnel statuses (not new, not closed) — leads that count as "active".
const ACTIVE_STATUSES = [
  "webinar_interested", "webinar_attended", "event_interested",
  "event_attended", "course_interested", "followup",
];

const STATUS_MIX = {
  old: [
    { value: "new", weight: 4 }, { value: "webinar_interested", weight: 9 }, { value: "webinar_attended", weight: 11 },
    { value: "event_interested", weight: 9 }, { value: "event_attended", weight: 11 }, { value: "course_interested", weight: 9 },
    { value: "converted", weight: 14 }, { value: "followup", weight: 6 }, { value: "dead", weight: 12 }, { value: "invalid", weight: 6 },
  ],
  // No "converted" here — cohort leads only reach that state through convert(),
  // which also writes the IfoConversion record. (The old-bank does the same.)
  recent: [
    { value: "new", weight: 18 }, { value: "webinar_interested", weight: 22 }, { value: "webinar_attended", weight: 18 },
    { value: "event_interested", weight: 14 }, { value: "event_attended", weight: 10 }, { value: "course_interested", weight: 8 },
    { value: "followup", weight: 6 }, { value: "dead", weight: 6 }, { value: "invalid", weight: 4 },
  ],
  current: [
    { value: "new", weight: 40 }, { value: "webinar_interested", weight: 26 }, { value: "webinar_attended", weight: 14 },
    { value: "event_interested", weight: 9 }, { value: "event_attended", weight: 5 }, { value: "course_interested", weight: 3 },
    { value: "followup", weight: 3 }, { value: "invalid", weight: 4 },
  ],
};

export async function seedDemo({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);

  await Promise.all([
    Lead.deleteMany({}), Remark.deleteMany({}), Call.deleteMany({}), Webinar.deleteMany({}),
    Event.deleteMany({}), IfoConversion.deleteMany({}), Target.deleteMany({}),
    User.deleteMany({ role: { $ne: "admin" } }),
  ]);
  // Keep the three real starting accounts alongside the demo team.
  await seedBase({ quiet: true });

  // --- Team -----------------------------------------------------------
  const managers = [];
  for (const name of ["Priya Menon", "Arjun Nair"]) {
    managers.push(
      await User.create({
        name,
        email: `${name.split(" ")[0].toLowerCase()}.manager@rbh.com`,
        password: "Test@123",
        role: "manager",
        phone: phone(),
        ...cityState(),
      })
    );
  }
  const salespeople = [];
  for (let i = 0; i < 10; i++) {
    salespeople.push(
      await User.create({
        name: faker.person.fullName(),
        email: `sales${i + 1}@rbh.com`,
        password: "Test@123",
        role: "salesperson",
        phone: phone(),
        manager: managers[i % 2]._id,
        joiningDate: faker.date.past({ years: 2 }),
        ...cityState(),
      })
    );
  }

  // --- Targets for current + previous month -------------------------
  const curP = { month: NOW.getMonth() + 1, year: NOW.getFullYear() };
  const prevD = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1);
  const prevP = { month: prevD.getMonth() + 1, year: prevD.getFullYear() };

  const targetOf = new Map();
  const targetDocs = [];
  for (const sp of salespeople) {
    const base = {
      leadTarget: faker.number.int({ min: 35, max: 60 }),
      callTarget: faker.number.int({ min: 60, max: 110 }),
      conversionTarget: faker.number.int({ min: 5, max: 12 }),
      // ~2.9L avg deal × ~8 conversions ≈ 23L, so target that band.
      revenueTarget: faker.number.int({ min: 18, max: 34 }) * 100000,
    };
    targetOf.set(String(sp._id), base);
    for (const p of [curP, prevP])
      targetDocs.push({ salesperson: sp._id, ...p, ...base, setBy: rand(managers)._id });
  }
  await Target.insertMany(targetDocs);

  // --- Buffers + one lead factory ---------------------------------
  const leadDocs = [];
  const remarkDocs = [];
  const callDocs = [];
  const ifoDocs = [];

  const makeLead = (sp, createdAt, status, statusAt) => {
    const [city, state] = rand(CITIES);
    const _id = new mongoose.Types.ObjectId();
    const changedAt = status === "new" ? createdAt : statusAt || between(createdAt, NOW);
    const lead = {
      _id,
      name: faker.person.fullName(),
      phone: phone(),
      email: faker.internet.email().toLowerCase(),
      restaurantName: brand(),
      city,
      state,
      source: rand(LEAD_SOURCES),
      status,
      statusChangedAt: changedAt,
      assignedTo: sp._id,
      createdBy: sp._id,
      potentialValue: faker.number.int({ min: 40, max: 600 }) * 1000,
      lostReason:
        status === "dead"
          ? rand(["Budget", "Chose competitor", "No response", "Not expanding"])
          : status === "invalid"
          ? rand(["Wrong number", "Not a decision maker", "Duplicate", "Test entry"])
          : undefined,
      createdAt,
      updatedAt: changedAt,
    };
    leadDocs.push(lead);
    remarkDocs.push({ lead: _id, author: sp._id, text: "Lead created.", type: "system", createdAt });
    for (let k = 0; k < faker.number.int({ min: 0, max: 4 }); k++)
      remarkDocs.push({ lead: _id, author: sp._id, text: rand(NOTE_LINES), type: "note", createdAt: between(createdAt, NOW) });
    return lead;
  };

  const convert = (lead, sp, when) => {
    lead.status = "converted";
    lead.statusChangedAt = when;
    // ~⅔ IFO, ⅓ RBC; deal value drifts around the standard for the type.
    const conversionType = Math.random() < 0.66 ? "ifo" : "rbc";
    const dealValue = Math.round(
      (CONVERSION_DEFAULT_VALUE[conversionType] *
        faker.number.float({ min: 0.9, max: 1.25, fractionDigits: 2 })) /
        10000
    ) * 10000;
    // Payment progress: mostly fully paid, some on an instalment plan — built
    // as 1–3 payment entries so the history has something to show.
    const paidFraction = faker.helpers.weightedArrayElement([
      { value: 1, weight: 52 },
      { value: 0.7, weight: 18 },
      { value: 0.45, weight: 18 },
      { value: 0.2, weight: 12 },
    ]);
    const totalPaid = Math.round((dealValue * paidFraction) / 1000) * 1000;
    const payments = [];
    if (totalPaid > 0) {
      const first = paidFraction >= 1 ? totalPaid : Math.round(totalPaid * 0.5 / 1000) * 1000;
      payments.push({ amount: first, note: "At conversion", recordedBy: sp._id, createdAt: when });
      let rest = totalPaid - first;
      while (rest > 1000) {
        const part = rest > 40000 ? Math.round(rest * 0.6 / 1000) * 1000 : rest;
        payments.push({
          amount: part,
          note: "Instalment",
          recordedBy: sp._id,
          createdAt: between(when, NOW),
        });
        rest -= part;
      }
    }
    ifoDocs.push({
      lead: lead._id,
      convertedBy: sp._id,
      conversionType,
      outletName: lead.restaurantName,
      outletCity: lead.city,
      dealValue,
      amountReceived: totalPaid,
      payments,
      conversionDate: when,
      notes: paidFraction < 1 ? "On an instalment plan." : "Paid in full, live on aggregators.",
      createdAt: when,
    });
  };

  // --- Bank of older leads for funnel depth (all > 2 months old) ------
  const oldStart = faker.date.past({ years: 1 });
  for (let i = 0; i < 120; i++) {
    const sp = rand(salespeople);
    const createdAt = between(oldStart, monthStart(2));
    const lead = makeLead(
      sp,
      createdAt,
      faker.helpers.weightedArrayElement(STATUS_MIX.old),
      between(createdAt, monthStart(2))
    );
    if (lead.status === "converted") convert(lead, sp, between(createdAt, monthStart(2)));
  }

  // --- Per-salesperson monthly cohorts -----------------------
  const daysInMonth = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();
  const cohorts = [
    { start: monthStart(2), end: monthEnd(2), frac: 1, mix: "recent" },
    { start: monthStart(1), end: monthEnd(1), frac: 1, mix: "recent" },
    // Current month so far — kept proportional to elapsed days (with a small
    // floor) so the Daily Report shows a realistic daily pace, not a 3× spike.
    { start: monthStart(0), end: NOW, frac: Math.max(0.12, NOW.getDate() / daysInMonth), mix: "current" },
  ];

  for (const sp of salespeople) {
    const t = targetOf.get(String(sp._id));
    for (const c of cohorts) {
      const attain = faker.number.float({ min: 0.5, max: 1.15, fractionDigits: 2 });
      // Per-metric jitter so leads / calls / conversions don't move in lockstep.
      const jit = () => attain * faker.number.float({ min: 0.82, max: 1.18, fractionDigits: 2 });
      const nLeads = Math.round(t.leadTarget * jit() * c.frac);
      const nCalls = Math.round(t.callTarget * jit() * c.frac);
      const nConv = Math.round(t.conversionTarget * jit() * c.frac);

      const cohortLeads = [];
      for (let i = 0; i < nLeads; i++) {
        const createdAt = between(c.start, c.end);
        cohortLeads.push(
          makeLead(sp, createdAt, faker.helpers.weightedArrayElement(STATUS_MIX[c.mix]), between(createdAt, c.end))
        );
      }

      const callable = cohortLeads.length
        ? cohortLeads
        : leadDocs.filter((l) => String(l.assignedTo) === String(sp._id));
      for (let i = 0; i < nCalls && callable.length; i++) {
        const lead = rand(callable);
        const completedAt = between(c.start, c.end);
        callDocs.push({
          lead: lead._id,
          calledBy: sp._id,
          scheduledAt: completedAt,
          completedAt,
          status: "completed",
          outcome: rand(CALL_OUTCOMES),
          notes: faker.lorem.sentence(),
          createdAt: completedAt,
        });
      }

      for (const lead of cohortLeads
        .filter((l) => !["converted", "dead", "invalid"].includes(l.status))
        .sort(() => Math.random() - 0.5)
        .slice(0, nConv))
        convert(lead, sp, between(c.start, c.end));
    }
  }

  // --- Open follow-ups: some due today / overdue ------------
  const openLeads = leadDocs.filter((l) => ACTIVE_STATUSES.includes(l.status));
  for (const lead of faker.helpers.arrayElements(openLeads, Math.min(55, openLeads.length)))
    lead.nextFollowUpDate = faker.datatype.boolean() ? faker.date.recent({ days: 4 }) : faker.date.soon({ days: 10 });

  await Lead.insertMany(leadDocs);
  await Remark.insertMany(remarkDocs);

  // --- Scheduled / missed / today's calls -----------------
  const callableAll = leadDocs.filter((l) => ACTIVE_STATUSES.includes(l.status));
  for (let i = 0; i < 90 && callableAll.length; i++) {
    const lead = rand(callableAll);
    callDocs.push(
      Math.random() < 0.6
        ? { lead: lead._id, calledBy: lead.assignedTo, scheduledAt: faker.date.soon({ days: 8 }), status: "scheduled" }
        : { lead: lead._id, calledBy: lead.assignedTo, scheduledAt: faker.date.recent({ days: 6 }), status: "missed" }
    );
  }
  for (const sp of salespeople) {
    const mine = callableAll.filter((l) => String(l.assignedTo) === String(sp._id));
    if (!mine.length) continue;
    const t = new Date();
    t.setHours(faker.number.int({ min: 10, max: 18 }), 0, 0, 0);
    callDocs.push({ lead: rand(mine)._id, calledBy: sp._id, scheduledAt: t, status: "scheduled" });
  }
  await Call.insertMany(callDocs);
  await IfoConversion.insertMany(ifoDocs);

  // --- Webinars & Events (one completed in each of the last 2 months) ---
  const pick = (n) => faker.helpers.arrayElements(leadDocs, n).map((l) => l._id);
  const regs = (n, rate, when) => pick(n).map((lead) => ({ lead, registeredAt: when, attended: Math.random() < rate }));
  const invitees = (n, rate) =>
    pick(n).map((lead) => ({ lead, rsvp: rand(["invited", "confirmed", "confirmed", "declined"]), attended: Math.random() < rate }));

  await Webinar.insertMany([
    { title: "Scaling Your Cloud Kitchen in 2026", description: "Playbook for multi-brand delivery ops.", scheduledAt: between(monthStart(0), NOW), host: rand(managers)._id, status: "completed", registrations: regs(64, 0.55, monthStart(0)) },
    { title: "Menu Engineering for Higher Margins", description: "Costing, pricing, and combos that convert.", scheduledAt: between(monthStart(1), monthEnd(1)), host: rand(managers)._id, status: "completed", registrations: regs(58, 0.6, monthStart(1)) },
    { title: "From Home Kitchen to Registered IFO", description: "Licensing, FSSAI, and going official.", scheduledAt: faker.date.soon({ days: 9 }), host: rand(managers)._id, status: "upcoming", registrations: regs(40, 0, NOW) },
    { title: "Delivery Aggregator Economics", description: "Commission math and what to negotiate.", scheduledAt: faker.date.soon({ days: 20 }), host: rand(managers)._id, status: "upcoming", registrations: regs(31, 0, NOW) },
  ]);
  await Event.insertMany([
    { title: "RBH Partner Meetup — Mumbai", venue: "Trident, BKC", city: "Mumbai", date: between(monthStart(0), NOW), host: rand(managers)._id, status: "completed", invitees: invitees(40, 0.62) },
    { title: "Tasting & Kitchen Tour — Pune", venue: "RBH Central Kitchen", city: "Pune", date: between(monthStart(1), monthEnd(1)), host: rand(managers)._id, status: "completed", invitees: invitees(28, 0.7) },
    { title: "Founder Roundtable — Bengaluru", venue: "The Leela Palace", city: "Bengaluru", date: faker.date.soon({ days: 15 }), host: rand(managers)._id, status: "upcoming", invitees: invitees(33, 0) },
    { title: "Delhi NCR Operator Summit", venue: "Andaz Delhi", city: "Delhi", date: faker.date.soon({ days: 32 }), host: rand(managers)._id, status: "upcoming", invitees: invitees(50, 0) },
  ]);

  const summary = {
    managers: managers.length,
    salespeople: salespeople.length,
    leads: leadDocs.length,
    remarks: remarkDocs.length,
    calls: callDocs.length,
    webinars: 4,
    events: 4,
    ifoConversions: ifoDocs.length,
    targets: targetDocs.length,
  };
  log("[seed:demo]", JSON.stringify(summary));
  return {
    summary,
    logins: [
      ...managers.map((m) => ({ role: "manager", email: m.email })),
      ...salespeople.map((s) => ({ role: "salesperson", email: s.email })),
    ],
  };
}
