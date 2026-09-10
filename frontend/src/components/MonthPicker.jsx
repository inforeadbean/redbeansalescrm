import { MONTHS } from "../utils/format.js";

// Two selects — month + year. `value` is { month, year }; `onChange` gets the
// next value. `month` is normally 1–12, but with `allowYear` / `allowAllTime`
// it can also be the string "year" (whole selected year) or "all" (all time —
// the year select then hides, since it no longer applies).
export default function MonthPicker({ value, onChange, allowYear = false, allowAllTime = false }) {
  const years = [0, 1, 2].map((d) => new Date().getFullYear() - d);
  const isAllTime = value.month === "all";
  const setMonth = (raw) =>
    onChange({ ...value, month: raw === "year" || raw === "all" ? raw : Number(raw) });

  return (
    <div className="flex gap-2">
      <select
        value={value.month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
      >
        {allowAllTime && <option value="all">All time</option>}
        {allowYear && <option value="year">Full year</option>}
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      {!isAllTime && (
        <select
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
