import Listbox from "./ui/Listbox.jsx";

// A single dropdown that slices a list to a time window. The CRM fills up with
// back-dated data imported from an old system, so the working lists default to
// "This month" — old records stay one click away under "All time".
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PERIODS = [
  { key: "month", label: "This month" },
  { key: "prev", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

// → { from, to } as yyyy-mm-dd (or undefined for "all time").
export function periodRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "month":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "prev":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "3m": {
      const s = new Date(now);
      s.setMonth(s.getMonth() - 3);
      return { from: iso(s), to: iso(now) };
    }
    case "year":
      return { from: iso(new Date(y, 0, 1)), to: iso(now) };
    default:
      return { from: undefined, to: undefined };
  }
}

export const periodLabel = (key) => PERIODS.find((p) => p.key === key)?.label || "This month";

export default function PeriodFilter({ value, onChange, className = "" }) {
  return (
    <Listbox
      value={value}
      onChange={onChange}
      title="Time window"
      className={`w-40 ${className}`}
      options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
    />
  );
}
