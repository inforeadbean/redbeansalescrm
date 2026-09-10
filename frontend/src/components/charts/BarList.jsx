import { BRAND } from "../../utils/chartTheme.js";

// Horizontal labelled bars — the right form for "magnitude across a handful of
// named categories" (lead funnel, top performers, target progress). Pure
// divs: bars anchor to the left baseline, data-ends are rounded, values are
// direct-labelled in ink (never on the bar fill).
export default function BarList({ items, valueFormat = (n) => n, barColor = BRAND, max, onItemClick }) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li
          key={it.label}
          onClick={onItemClick ? () => onItemClick(it) : undefined}
          className={`grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm rounded-md ${
            onItemClick ? "cursor-pointer hover:bg-gray-50 -mx-1 px-1 py-0.5 transition-colors" : ""
          }`}
        >
          <span className="text-gray-500 truncate" title={it.label}>
            {it.label}
          </span>
          <span className="h-5 bg-gray-100 rounded-full overflow-hidden">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(2, (it.value / peak) * 100)}%`, background: it.color || barColor }}
            />
          </span>
          <span className="text-gray-800 font-semibold tabular-nums text-right w-16">
            {valueFormat(it.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
