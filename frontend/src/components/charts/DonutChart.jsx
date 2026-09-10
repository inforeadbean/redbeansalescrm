import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { pct } from "../../utils/format.js";

// Composition donut — "what share of leads is in each stage". `data` =
// [{ label, value, color }]. A centre label shows the total. Legend is a
// separate list beside it (identity is never colour-alone).
export default function DonutChart({ data, height = 190, centerLabel = "leads", format = (n) => n, onItemClick }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown.length ? shown : [{ label: "None", value: 1, color: "#E5E7EB" }]}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={shown.length > 1 ? 2 : 0}
              stroke="#fff"
              strokeWidth={2}
            >
              {(shown.length ? shown : [{ color: "#E5E7EB" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [`${format(v)} (${pct(v, total)}%)`, n]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-gray-800 leading-none">{format(total)}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{centerLabel}</span>
        </div>
      </div>

      <ul className="text-sm space-y-1.5 flex-1 min-w-0">
        {data.map((d) => (
          <li
            key={d.label}
            onClick={onItemClick && d.value > 0 ? () => onItemClick(d) : undefined}
            className={`flex items-center gap-2 rounded-md ${
              onItemClick && d.value > 0 ? "cursor-pointer hover:bg-gray-50 -mx-1 px-1 py-0.5 transition-colors" : ""
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-gray-600 flex-1 truncate">{d.label}</span>
            <span className="text-gray-800 font-medium tabular-nums">{d.value}</span>
            <span className="text-gray-400 text-xs w-10 text-right tabular-nums">{pct(d.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
