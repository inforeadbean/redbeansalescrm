import { Link } from "react-router-dom";
import { MdDelete } from "react-icons/md";
import Badge from "./ui/Badge.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import LeadStageSelect from "./LeadStageSelect.jsx";
import { LEAD_STATUS, RSVP_STATUS } from "../utils/constants.js";

// Shared attendee grid for webinar registrations and event invitees.
// `rows` items: { _id, lead, attended, rsvp? }. `onRsvp` enables the RSVP
// select (events only). `onStageChange(lead, toStatus)` turns the Stage cell
// into an inline dropdown so a lead can be advanced (e.g. → Zoom 1 Attended)
// without leaving the page.
export default function AttendeeTable({ rows, onToggleAttended, onRsvp, onRemove, onStageChange }) {
  if (!rows?.length) return <EmptyState title="No one added yet" message="Use “Add leads” above." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <th className="py-2 px-3 font-medium">Lead</th>
            <th className="py-2 px-3 font-medium">Owner</th>
            <th className="py-2 px-3 font-medium">Stage</th>
            {onRsvp && <th className="py-2 px-3 font-medium">RSVP</th>}
            <th className="py-2 px-3 font-medium text-center">Attended</th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r._id}>
              <td className="py-2.5 px-3">
                {r.lead ? (
                  <Link to={`/leads/${r.lead._id}`} className="font-medium text-gray-800 hover:text-primary-dark">
                    {r.lead.name}
                  </Link>
                ) : (
                  <span className="text-gray-400">Deleted lead</span>
                )}
                <p className="text-xs text-gray-400">{r.lead?.restaurantName || r.lead?.phone}</p>
              </td>
              <td className="py-2.5 px-3 text-gray-500">{r.lead?.assignedTo?.name || "—"}</td>
              <td className="py-2.5 px-3">
                {r.lead &&
                  (onStageChange ? (
                    <LeadStageSelect lead={r.lead} onPick={onStageChange} />
                  ) : (
                    <Badge map={LEAD_STATUS} value={r.lead.status} />
                  ))}
              </td>
              {onRsvp && (
                <td className="py-2.5 px-3">
                  <select
                    value={r.rsvp}
                    onChange={(e) => onRsvp(r._id, e.target.value)}
                    className="text-xs rounded-md border border-gray-200 px-1.5 py-1 bg-white"
                  >
                    {Object.entries(RSVP_STATUS).map(([v, m]) => (
                      <option key={v} value={v}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </td>
              )}
              <td className="py-2.5 px-3 text-center">
                <input
                  type="checkbox"
                  checked={!!r.attended}
                  onChange={(e) => onToggleAttended(r._id, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </td>
              <td className="py-2.5 px-3 text-right">
                <button
                  onClick={() => onRemove(r._id)}
                  className="p-1 text-gray-300 hover:text-red-500"
                  title="Remove"
                >
                  <MdDelete size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
