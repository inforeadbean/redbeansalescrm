import { MdPhone, MdStorefront, MdPerson, MdSchedule, MdUndo } from "react-icons/md";
import { inrCompact, fmtDate, pct } from "../../utils/format.js";
import { LEAD_CLOSED, LEAD_STATUS } from "../../utils/constants.js";

// A single lead tile. Draggable via native HTML5 DnD — it stashes the lead id
// on the dataTransfer; the column handles the drop.
export default function KanbanCard({ lead, onClick, onUndo, onDragStart, onDragEnd, dragging }) {
  // Confirmed money (green) once won with a recorded deal; an estimate (muted)
  // while still in play or if no deal value was captured.
  const confirmed = lead.status === "converted" && lead.dealValue != null;
  const amount = confirmed ? lead.dealValue : lead.potentialValue;
  const won = confirmed;

  // How long the lead has sat in this stage — a nudge for stale leads. Not
  // shown once it's a client / closed (staleness doesn't apply there).
  const daysInStage = lead.statusChangedAt
    ? Math.floor((Date.now() - new Date(lead.statusChangedAt)) / 86400000)
    : 0;
  const showAge = !LEAD_CLOSED.includes(lead.status) && daysInStage >= 1;
  const ageClass =
    daysInStage >= 14
      ? "bg-red-100 text-red-700"
      : daysInStage >= 7
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-500";

  // One-step "oops" for the last move — see LeadDetail / undoLeadStatus.
  const hist = lead.statusHistory || [];
  const prevStage = lead.statusRevertable && hist.length >= 2 ? hist[hist.length - 2].status : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead._id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(lead);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(lead)}
      className={`bg-white rounded-lg border border-gray-200 p-3 text-sm shadow-sm cursor-pointer hover:border-primary/40 hover:shadow transition ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-800 leading-tight">{lead.name}</p>
        {showAge && (
          <span
            className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ageClass}`}
            title={`${daysInStage} day${daysInStage === 1 ? "" : "s"} in this stage`}
          >
            <MdSchedule size={11} />
            {daysInStage}d
          </span>
        )}
      </div>
      {lead.restaurantName && (
        <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
          <MdStorefront size={13} /> {lead.restaurantName}
        </p>
      )}
      <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
        <MdPhone size={13} /> {lead.phone}
      </p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="flex items-center gap-1 text-xs text-gray-400 truncate">
          <MdPerson size={13} /> {lead.assignedTo?.name || "Unassigned"}
        </span>
        {amount > 0 && (
          <span
            className={`text-xs font-semibold shrink-0 ${won ? "text-green-600" : "text-gray-500"}`}
            title={won ? "Confirmed deal value" : "Estimated potential"}
          >
            {inrCompact(amount)}
          </span>
        )}
      </div>
      {won && lead.amountReceived != null && lead.amountReceived < lead.dealValue && (
        <p className={`text-[11px] mt-1 font-medium ${lead.amountReceived === 0 ? "text-red-500" : "text-amber-600"}`}>
          {lead.amountReceived === 0 ? "Unpaid" : `${pct(lead.amountReceived, lead.dealValue)}% paid`}
        </p>
      )}
      {lead.nextFollowUpDate && (
        <p className="text-[11px] text-amber-600 mt-1">Follow-up {fmtDate(lead.nextFollowUpDate)}</p>
      )}
      {prevStage && onUndo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUndo(lead);
          }}
          title={`Undo — back to ${LEAD_STATUS[prevStage]?.label || prevStage}`}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-50"
        >
          <MdUndo size={12} /> Undo
        </button>
      )}
    </div>
  );
}
