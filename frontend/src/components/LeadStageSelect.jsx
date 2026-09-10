import { MdExpandMore } from "react-icons/md";
import { LEAD_STATUS, LEAD_STATUS_ORDER } from "../utils/constants.js";
import Listbox from "./ui/Listbox.jsx";

// Inline stage switcher for lead tables / lists — lets anyone change a lead's
// stage without opening it. Renders as the stage pill; picking a new stage
// calls `onPick(lead, toStatus)`, which the parent routes through
// `useStageChange` so the full flow still runs (remark + next follow-up,
// webinar/event picker, backward-move confirm, leaving-Converted warning,
// record-conversion form). A custom Listbox rather than a native <select> so
// both the pill and its open option list are fully styled (each stage shows
// its own colour dot) instead of an OS-themed popup.
const OPTIONS = LEAD_STATUS_ORDER.map((k) => ({
  value: k,
  label: LEAD_STATUS[k].label,
  dot: LEAD_STATUS[k].dot,
}));

export default function LeadStageSelect({ lead, onPick, disabled = false, className = "" }) {
  const s = LEAD_STATUS[lead?.status] || {};
  return (
    <Listbox
      value={lead?.status || ""}
      disabled={disabled}
      title="Change stage"
      options={OPTIONS}
      onChange={(to) => {
        if (to && to !== lead.status) onPick(lead, to);
      }}
      className={`max-w-[13rem] ${className}`}
      buttonClassName={`w-full flex items-center gap-1.5 cursor-pointer rounded-full border border-black/[0.06] shadow-sm pl-2.5 pr-2 py-1.5 text-xs font-semibold tracking-tight transition-shadow hover:shadow disabled:cursor-default disabled:opacity-60 disabled:shadow-none ${
        s.color || "bg-gray-100 text-gray-600"
      }`}
      renderTrigger={() => (
        <>
          {s.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />}
          <span className="truncate flex-1 text-left">{s.label || "—"}</span>
          <MdExpandMore size={14} className="shrink-0 opacity-60" />
        </>
      )}
    />
  );
}
