// Small status pill. Pass either `color` (Tailwind classes) directly, or look
// one up from a constants map: <Badge map={LEAD_STATUS} value={lead.status} />
import { labelOf } from "../../utils/constants.js";

export default function Badge({ map, value, color, dot, children, className = "" }) {
  const resolved = color || map?.[value]?.color || "bg-gray-100 text-gray-600";
  const dotClass = dot ?? map?.[value]?.dot;
  const text = children ?? (map ? labelOf(map, value) : value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ring-black/5 ${resolved} ${className}`}
    >
      {dotClass && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />}
      {text}
    </span>
  );
}
