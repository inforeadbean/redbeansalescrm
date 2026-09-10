import { Link } from "react-router-dom";

// KPI tile. `hint` is a small caption under the value; `trend` (a number)
// renders a green/red delta chip. `accent` colours the icon chip. Pass `to`
// (a route) to make the whole tile a link that drills into those records.
export default function StatCard({ label, value, hint, icon: Icon, trend, accent = "text-primary", to, state }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide leading-tight">
          {label}
        </span>
        {Icon && (
          <span className={`h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center ${accent}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold text-gray-900 mt-2 leading-none tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-2 min-h-[16px]">
        {trend != null && (
          <span className={`text-xs font-bold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-xs font-semibold text-gray-500 leading-tight">{hint}</span>}
      </div>
    </>
  );

  const base =
    "bg-white rounded-xl border border-gray-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_-2px_rgba(16,24,40,0.06)] p-4";
  if (to) {
    return (
      <Link to={to} state={state} className={`${base} block transition-shadow hover:shadow-md hover:border-gray-200`}>
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
