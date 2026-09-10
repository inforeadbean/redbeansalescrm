// Small status pill. Pass either `color` (Tailwind classes) directly, or look
// one up from a constants map: <Badge map={LEAD_STATUS} value={lead.status} />
import { labelOf } from "../../utils/constants.js";

export default function Badge({ map, value, color, children, className = "" }) {
  const resolved = color || map?.[value]?.color || "bg-gray-100 text-gray-600";
  const text = children ?? (map ? labelOf(map, value) : value);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${resolved} ${className}`}
    >
      {text}
    </span>
  );
}
