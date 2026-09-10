import { LEAD_STATUS, LEAD_STATUS_ORDER } from "../utils/constants.js";

// Inline stage switcher for lead tables / lists — lets anyone change a lead's
// stage without opening it. Renders as the stage pill; picking a new stage
// calls `onPick(lead, toStatus)`, which the parent routes through
// `useStageChange` so the full flow still runs (remark + next follow-up,
// webinar/event picker, backward-move confirm, leaving-Converted warning,
// record-conversion form). Stops click bubbling so it works inside a
// clickable table row.
export default function LeadStageSelect({ lead, onPick, disabled = false, className = "" }) {
  const s = LEAD_STATUS[lead?.status] || {};
  return (
    <select
      value={lead?.status || ""}
      disabled={disabled}
      title="Change stage"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const to = e.target.value;
        if (to && to !== lead.status) onPick(lead, to);
      }}
      className={`max-w-[12rem] cursor-pointer appearance-none rounded-full border-0 pl-2.5 pr-6 py-1 text-xs font-semibold disabled:cursor-default disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        s.color || "bg-gray-100 text-gray-600"
      } ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.4rem center",
        backgroundSize: "0.85em",
      }}
    >
      {LEAD_STATUS_ORDER.map((k) => (
        <option key={k} value={k} className="bg-white font-normal text-gray-800">
          {LEAD_STATUS[k].label}
        </option>
      ))}
    </select>
  );
}
