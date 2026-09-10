// Display formatters. The CRM is India-only, so money is INR and dates are
// day-month-year. Everything tolerates null/undefined and returns an em-dash.

const EMPTY = "—";

export function inr(n) {
  if (n == null || n === "") return EMPTY;
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Compact money for KPI tiles: ₹1.2L, ₹3.4Cr, ₹45,000.
export function inrCompact(n) {
  const v = Number(n || 0);
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 1) + "Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1) + "L";
  if (v >= 1e3) return "₹" + (v / 1e3).toFixed(0) + "k";
  return "₹" + v;
}

export function fmtDate(d) {
  if (!d) return EMPTY;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d) {
  if (!d) return EMPTY;
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Exact timestamp down to the second, e.g. "04 Sep 2026, 03:45:12 pm".
// Used where the precise moment matters (activity timeline).
export function fmtDateTimeFull(d) {
  if (!d) return EMPTY;
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// "3 days ago", "in 2 hours", "just now".
export function fromNow(d) {
  if (!d) return EMPTY;
  const diff = Date.now() - new Date(d).getTime();
  const abs = Math.abs(diff);
  const units = [
    ["year", 31536e6],
    ["month", 2592e6],
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  for (const [name, ms] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms);
      const label = `${n} ${name}${n > 1 ? "s" : ""}`;
      return diff >= 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return "just now";
}

const HONORIFICS = /^(mr|mrs|ms|miss|dr|prof)\.?$/i;

// Name parts with any leading honorific dropped.
function nameParts(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 && HONORIFICS.test(parts[0]) ? parts.slice(1) : parts;
}

export function firstName(name = "") {
  return nameParts(name)[0] || name;
}

export function initials(name = "") {
  return nameParts(name)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Orders a list of Zoom meetings / events so the one a picker should default
// to sits at index 0: the soonest one still upcoming, or — if every session
// in the list is already past — the most recently-completed one. Used
// wherever a lead is being registered/linked to "the next session", so the
// preselected option (and the option actually shown first) is whichever one
// a salesperson would actually mean by "the next Zoom" / "the next event".
export function byNearestFirst(list, dateKey = "scheduledAt") {
  const now = Date.now();
  return [...(list || [])].sort((a, b) => {
    const da = new Date(a[dateKey]).getTime() - now;
    const db = new Date(b[dateKey]).getTime() - now;
    const aFuture = da >= 0;
    const bFuture = db >= 0;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? da - db : db - da;
  });
}
