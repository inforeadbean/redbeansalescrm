import { LEAD_STATUS_LABELS } from "./labels.js";

// The one-directional part of the pipeline (mirrors the frontend's
// constants.js FUNNEL_ORDER). `followup` / `dead` / `invalid` sit outside it —
// moving to those is never "backward".
export const FUNNEL_ORDER = [
  "new",
  "webinar_interested",
  "webinar_attended",
  "event_interested",
  "event_attended",
  "course_interested",
  "converted",
];

// The forward progress stages — FUNNEL_ORDER without the terminal "converted",
// which is walked back on un-conversion and so shouldn't count as a stage the
// lead is pinned past.
const FUNNEL_PROGRESS = FUNNEL_ORDER.slice(0, -1);

// True when both stages are on the funnel and `to` is an earlier one.
export const isBackwardMove = (from, to) => {
  const f = FUNNEL_ORDER.indexOf(from);
  const t = FUNNEL_ORDER.indexOf(to);
  return f !== -1 && t !== -1 && t < f;
};

// The furthest progress stage this lead has ever reached, as a FUNNEL_PROGRESS
// index (-1 if it never entered the funnel). `history` is a Lead.statusHistory
// array (entries are { status } or bare strings).
export const furthestFunnelIndex = (history) => {
  let max = -1;
  for (const h of Array.isArray(history) ? history : []) {
    const i = FUNNEL_PROGRESS.indexOf(typeof h === "string" ? h : h?.status);
    if (i > max) max = i;
  }
  return max;
};

// Leads only move FORWARD — for every role (salesperson, manager, admin).
// Blocked: (a) any backward funnel step, (b) moving out of "Converted",
// (c) reopening a "Dead" / "Invalid" lead, (d) dropping a Follow-up lead back
// below the funnel stage it had already reached. Still allowed: forward funnel
// steps, sending any active lead to Follow-up / Dead / Invalid, and resuming a
// Follow-up lead at its furthest stage or onward (Follow-up is the "stalled,
// chase later" bay, not a rewind). To undo a sale, a manager deletes the
// conversion record. A dead lead that comes back is re-added as a new lead.
// `history` (Lead.statusHistory) is optional but needed for rule (d).
// Returns a reason string, or null.
export function moveBlocked(from, to, history) {
  if (!from || !to || from === to) return null;
  if (from === "converted")
    return `A converted client can't be moved back. To undo the sale, delete its conversion record.`;
  if ((from === "dead" || from === "invalid") && to !== "dead" && to !== "invalid")
    return `This lead is marked ${LEAD_STATUS_LABELS[from] || from} and can't be reopened — add it again as a new lead if it comes back.`;
  if (isBackwardMove(from, to))
    return `Leads move forward only — can't go back to "${LEAD_STATUS_LABELS[to] || to}". If it has stalled, move it to Follow-up.`;
  if (from === "followup") {
    const toIdx = FUNNEL_PROGRESS.indexOf(to);
    const reached = furthestFunnelIndex(history);
    if (toIdx !== -1 && reached !== -1 && toIdx < reached)
      return `This lead already reached "${LEAD_STATUS_LABELS[FUNNEL_PROGRESS[reached]] || FUNNEL_PROGRESS[reached]}" before Follow-up — move it forward from there, not back to "${LEAD_STATUS_LABELS[to] || to}".`;
  }
  return null;
}
