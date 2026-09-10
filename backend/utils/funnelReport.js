import Lead from "../models/Lead.js";
import { LEAD_STATUS_LABELS } from "./labels.js";

// The advancing pipeline, in order. `followup` is a side bay and `dead` /
// `invalid` are exits — none of them belong on the funnel itself.
export const FUNNEL_STAGES = [
  "new",
  "webinar_interested",
  "webinar_attended",
  "event_interested",
  "event_attended",
  "course_interested",
  "converted",
];
const STAGE_INDEX = Object.fromEntries(FUNNEL_STAGES.map((s, i) => [s, i]));
const DEAD_STATES = ["dead", "invalid"];
const DAY = 86400000;

const label = (s) => LEAD_STATUS_LABELS[s] || s;
const round1 = (n) => Math.round((n || 0) * 10) / 10;
const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Fall back to a rough 2-point history for any lead the backfill hasn't touched.
const histOf = (l) =>
  Array.isArray(l.statusHistory) && l.statusHistory.length
    ? [...l.statusHistory].sort((a, b) => new Date(a.at) - new Date(b.at))
    : [
        { status: "new", at: l.createdAt },
        ...(l.status !== "new" ? [{ status: l.status, at: l.statusChangedAt }] : []),
      ];

// The furthest funnel stage a lead ever got to (its history + current status).
function furthestStage(l, hist) {
  let idx = -1;
  for (const h of hist) if (STAGE_INDEX[h.status] > idx) idx = STAGE_INDEX[h.status];
  if (STAGE_INDEX[l.status] > idx) idx = STAGE_INDEX[l.status];
  return idx;
}

// Flow analysis over the leads CREATED in [from, to): how far down the pipeline
// they got (a real, monotonic funnel — a lead that skipped a stage still counts
// as having passed it), where they stall or die, time spent in each stage, and
// how long lead → conversion takes.
export async function buildFunnelReport(salespersonIds, { from, to } = {}) {
  const match = { assignedTo: { $in: salespersonIds } };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const leads = await Lead.find(match)
    .select("status statusHistory createdAt statusChangedAt")
    .lean();

  const total = leads.length;
  const now = Date.now();

  const reached = Object.fromEntries(FUNNEL_STAGES.map((s) => [s, 0]));
  const dwell = Object.fromEntries(FUNNEL_STAGES.map((s) => [s, []]));
  const convertDays = [];

  for (const l of leads) {
    const hist = histOf(l);

    const far = furthestStage(l, hist);
    for (let i = 0; i <= far; i++) reached[FUNNEL_STAGES[i]]++;

    for (let i = 0; i < hist.length - 1; i++) {
      const s = hist[i].status;
      if (STAGE_INDEX[s] == null) continue;
      const d = (new Date(hist[i + 1].at) - new Date(hist[i].at)) / DAY;
      if (d >= 0) dwell[s].push(d);
    }

    if (l.status === "converted") {
      const conv = hist.find((h) => h.status === "converted");
      if (conv) convertDays.push((new Date(conv.at) - new Date(hist[0].at)) / DAY);
    }
  }

  const stages = FUNNEL_STAGES.map((s, i) => {
    const prev = i > 0 ? reached[FUNNEL_STAGES[i - 1]] : total;
    const drop = Math.max(0, prev - reached[s]);
    return {
      status: s,
      label: label(s),
      reached: reached[s],
      reachedPct: pctOf(reached[s], total),
      currentlyHere: leads.filter((l) => l.status === s).length,
      stepConversionPct: i === 0 ? 100 : pctOf(reached[s], prev),
      dropFromPrev: { count: drop, pct: i === 0 ? 0 : pctOf(drop, prev) },
      avgDaysInStage: round1(avg(dwell[s])),
      timedCount: dwell[s].length,
    };
  });

  // Where dead / invalid leads gave out — their furthest funnel stage.
  const diedAtCount = {};
  let deadTotal = 0;
  for (const l of leads) {
    if (!DEAD_STATES.includes(l.status)) continue;
    deadTotal++;
    const far = Math.max(0, furthestStage(l, histOf(l)));
    const s = FUNNEL_STAGES[far];
    diedAtCount[s] = (diedAtCount[s] || 0) + 1;
  }
  const diedAt = FUNNEL_STAGES.filter((s) => s !== "converted")
    .map((s) => ({ status: s, label: label(s), count: diedAtCount[s] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  // Open leads parked in each stage right now, and how stale they are.
  const openByStage = FUNNEL_STAGES.filter((s) => s !== "converted")
    .map((s) => {
      const here = leads.filter((l) => l.status === s);
      const ages = here.map((l) => (now - new Date(l.statusChangedAt)) / DAY);
      return {
        status: s,
        label: label(s),
        count: here.length,
        avgAgeDays: round1(avg(ages)),
        oldestDays: ages.length ? Math.round(Math.max(...ages)) : 0,
      };
    })
    .filter((r) => r.count > 0);

  const converted = leads.filter((l) => l.status === "converted").length;
  const followup = leads.filter((l) => l.status === "followup").length;

  return {
    range: { from: from || null, to: to || null },
    totalLeads: total,
    stages,
    diedAt,
    openByStage,
    outcomes: {
      converted,
      dead: leads.filter((l) => l.status === "dead").length,
      invalid: leads.filter((l) => l.status === "invalid").length,
      followup,
      open: total - converted - deadTotal - followup,
      conversionPct: pctOf(converted, total),
    },
    timeToConvert: {
      count: convertDays.length,
      avgDays: round1(avg(convertDays)),
      medianDays: round1(median(convertDays)),
      fastestDays: convertDays.length ? Math.round(Math.min(...convertDays)) : 0,
      slowestDays: convertDays.length ? Math.round(Math.max(...convertDays)) : 0,
    },
  };
}
