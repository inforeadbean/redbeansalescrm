import { MONTHS } from "../utils/format.js";
import Listbox from "./ui/Listbox.jsx";

// Two selects — month + year. `value` is { month, year }; `onChange` gets the
// next value. `month` is normally 1–12, but with `allowYear` / `allowAllTime`
// it can also be the string "year" (whole selected year) or "all" (all time —
// the year select then hides, since it no longer applies).
export default function MonthPicker({ value, onChange, allowYear = false, allowAllTime = false }) {
  const years = [0, 1, 2].map((d) => new Date().getFullYear() - d);
  const isAllTime = value.month === "all";
  const setMonth = (raw) =>
    onChange({ ...value, month: raw === "year" || raw === "all" ? raw : Number(raw) });

  const monthOptions = [
    ...(allowAllTime ? [{ value: "all", label: "All time" }] : []),
    ...(allowYear ? [{ value: "year", label: "Full year" }] : []),
    ...MONTHS.map((m, i) => ({ value: i + 1, label: m })),
  ];

  return (
    <div className="flex gap-2">
      <Listbox className="w-32" value={value.month} onChange={setMonth} options={monthOptions} />
      {!isAllTime && (
        <Listbox
          className="w-24"
          value={value.year}
          onChange={(y) => onChange({ ...value, year: Number(y) })}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />
      )}
    </div>
  );
}
