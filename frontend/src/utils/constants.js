// Single source of truth for every enum the backend defines, paired with a
// human label and the Tailwind classes for its pill. Keep the keys in sync
// with the matching `export const *_STATUSES` arrays in backend/models.

// The calling team's pipeline, in funnel order. ONE colour scheme, used
// everywhere (Kanban, funnel, pie, badges, the 5-for-3 table). Each channel
// keeps a hue: webinar = amber, event = blue, course→client = violet→green;
// the lighter shade is "interested" (lined up), the stronger shade is "done".
// Red = fresh lead, green = won, grey = dead/invalid, fuchsia = follow-up bay.
// `fill` is the hex for charts; `tint` is the soft Kanban column background.
export const LEAD_STATUS = {
  new: { label: "New", color: "bg-red-100 text-red-700", dot: "bg-red-500", text: "text-red-700", tint: "bg-red-50/70", fill: "#DC2626" },
  webinar_interested: { label: "Interested for Zoom 1", color: "bg-amber-50 text-amber-700", dot: "bg-amber-400", text: "text-amber-700", tint: "bg-amber-50/50", fill: "#FBBF24" },
  webinar_attended: { label: "Zoom 1 Attended", color: "bg-amber-100 text-amber-800", dot: "bg-amber-600", text: "text-amber-800", tint: "bg-amber-100/50", fill: "#D97706" },
  event_interested: { label: "Interested for event", color: "bg-blue-50 text-blue-700", dot: "bg-blue-400", text: "text-blue-700", tint: "bg-blue-50/50", fill: "#60A5FA" },
  event_attended: { label: "Event attended", color: "bg-blue-100 text-blue-800", dot: "bg-blue-600", text: "text-blue-800", tint: "bg-blue-100/50", fill: "#2563EB" },
  course_interested: { label: "Interested for course", color: "bg-violet-50 text-violet-700", dot: "bg-violet-400", text: "text-violet-700", tint: "bg-violet-50/50", fill: "#A78BFA" },
  converted: { label: "Converted", color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-600", text: "text-emerald-800", tint: "bg-emerald-50/60", fill: "#059669" },
  followup: { label: "Followup", color: "bg-fuchsia-100 text-fuchsia-700", dot: "bg-fuchsia-500", text: "text-fuchsia-700", tint: "bg-fuchsia-50/50", fill: "#C026D3" },
  dead: { label: "Dead", color: "bg-gray-100 text-gray-500", dot: "bg-gray-400", text: "text-gray-500", tint: "bg-gray-100/60", fill: "#9CA3AF" },
  invalid: { label: "Invalid", color: "bg-slate-200 text-slate-600", dot: "bg-slate-400", text: "text-slate-600", tint: "bg-slate-100/50", fill: "#64748B" },
};
// Funnel order — also the Kanban column order. Closed states shown as columns too.
export const LEAD_STATUS_ORDER = [
  "new",
  "webinar_interested",
  "webinar_attended",
  "event_interested",
  "event_attended",
  "course_interested",
  "converted",
  "followup",
  "dead",
  "invalid",
];

// Terminal states — a lead here is out of the active pipeline.
export const LEAD_CLOSED = ["converted", "dead", "invalid"];

// The one-directional part of the pipeline. `followup` / `dead` / `invalid`
// sit outside it — moving to/from those isn't "backward".
export const FUNNEL_ORDER = [
  "new",
  "webinar_interested",
  "webinar_attended",
  "event_interested",
  "event_attended",
  "course_interested",
  "converted",
];

// True when `to` is an EARLIER funnel stage than `from` (both on the funnel).
export const isBackwardMove = (from, to) => {
  const f = FUNNEL_ORDER.indexOf(from);
  const t = FUNNEL_ORDER.indexOf(to);
  return f !== -1 && t !== -1 && t < f;
};

// Leads move FORWARD only — for every role. Blocked: any backward funnel step,
// any move out of "Converted", and reopening a "Dead"/"Invalid" lead.
// `followup` is the "stalled, chase later" bay — sending a lead there, or
// moving a Follow-up lead anywhere, is always allowed. Returns a reason
// string, or null if the move is OK.
export const moveBlocked = (from, to) => {
  if (!from || !to || from === to) return null;
  if (from === "converted")
    return "A converted client can't be moved back — to undo the sale, delete its conversion record.";
  if ((from === "dead" || from === "invalid") && to !== "dead" && to !== "invalid")
    return "A dead / invalid lead can't be reopened — add it again as a new lead if it comes back.";
  if (isBackwardMove(from, to))
    return "Leads move forward only. If this one has stalled, move it to Follow-up.";
  return null;
};

export const LEAD_SOURCE = {
  webinar: { label: "Zoom meeting" },
  referral: { label: "Referral" },
  cold_call: { label: "Cold call" },
  social: { label: "Social" },
  walk_in: { label: "Walk-in" },
  other: { label: "Other" },
};

export const CALL_STATUS = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  missed: { label: "Missed", color: "bg-red-100 text-red-700" },
};

export const CALL_OUTCOME = {
  connected: { label: "Connected" },
  no_answer: { label: "No answer" },
  busy: { label: "Busy" },
  not_interested: { label: "Not interested" },
  callback: { label: "Callback requested" },
  converted: { label: "Converted" },
};

export const EVENT_STATUS = {
  upcoming: { label: "Upcoming", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", color: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};
export const WEBINAR_STATUS = EVENT_STATUS;

export const RSVP_STATUS = {
  invited: { label: "Invited", color: "bg-slate-100 text-slate-700" },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700" },
  declined: { label: "Declined", color: "bg-red-100 text-red-700" },
};

// The two conversion types RBH books, with their standard contract values.
export const CONVERSION_TYPE = {
  ifo: { label: "IFO", defaultValue: 200000, color: "bg-blue-100 text-blue-700" },
  rbc: { label: "RBC", defaultValue: 500000, color: "bg-primary-light text-primary-dark" },
};

export const LEADERBOARD_BADGES = {
  top_scorer: { label: "Top Scorer", icon: "🏆" },
  top_closer: { label: "Top Closer", icon: "🎯" },
  call_champion: { label: "Call Champion", icon: "📞" },
  revenue_king: { label: "Revenue King", icon: "💰" },
};

// Turn one of the maps above into <select> options.
export const optionsFrom = (map) =>
  Object.entries(map).map(([value, v]) => ({ value, label: v.label }));

export const labelOf = (map, key) => map[key]?.label ?? key ?? "—";
