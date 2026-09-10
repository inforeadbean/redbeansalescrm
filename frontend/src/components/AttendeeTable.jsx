import { useState } from "react";
import { Link } from "react-router-dom";
import { MdDelete } from "react-icons/md";
import Badge from "./ui/Badge.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import ConfirmDialog from "./ui/ConfirmDialog.jsx";
import LeadStageSelect from "./LeadStageSelect.jsx";
import Listbox from "./ui/Listbox.jsx";
import { LEAD_STATUS, RSVP_STATUS } from "../utils/constants.js";

// Shared attendee grid for webinar registrations and event invitees.
// `rows` items: { _id, lead, attended, rsvp? }. `onRsvp` enables the RSVP
// select (events only). `onStageChange(lead, toStatus)` turns the Stage cell
// into an inline dropdown so a lead can be advanced (e.g. → Zoom 1 Attended)
// without leaving the page.
// `sessionNoun` is used in the "mark present" confirmation ("… present in
// the meeting?") — ticking Attended can jump an early-stage lead forward, so
// it's worth a second look; un-ticking goes straight through.
// `canEditRow(row)` gates the attendance / RSVP / stage / remove controls for
// that row — a salesperson may only touch their own leads (the API enforces
// this too; disabling here just avoids a dead click).
export default function AttendeeTable({
  rows,
  onToggleAttended,
  onRsvp,
  onRemove,
  onStageChange,
  sessionNoun = "the meeting",
  canEditRow = () => true,
}) {
  const [confirmRow, setConfirmRow] = useState(null);

  if (!rows?.length) return <EmptyState title="No one added yet" message="Use “Add leads” above." />;

  const onCheck = (row, checked) => {
    if (checked) setConfirmRow(row);
    else onToggleAttended(row._id, false);
  };
  const lockedTitle = (row) =>
    `Only ${row.lead?.assignedTo?.name || "the lead's owner"} can change this — it's not your lead.`;

  return (
    <>
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
          {rows.map((r) => {
            const editable = canEditRow(r);
            return (
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
                  (onStageChange && editable ? (
                    <LeadStageSelect lead={r.lead} onPick={onStageChange} />
                  ) : (
                    <Badge map={LEAD_STATUS} value={r.lead.status} />
                  ))}
              </td>
              {onRsvp && (
                <td className="py-2.5 px-3">
                  <Listbox
                    value={r.rsvp}
                    disabled={!editable}
                    title={editable ? undefined : lockedTitle(r)}
                    onChange={(v) => onRsvp(r._id, v)}
                    className="w-32"
                    buttonClassName="rounded-md border border-gray-200 shadow-sm px-1.5 py-1 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    options={Object.entries(RSVP_STATUS).map(([v, m]) => ({ value: v, label: m.label }))}
                  />
                </td>
              )}
              <td className="py-2.5 px-3 text-center">
                <input
                  type="checkbox"
                  checked={!!r.attended}
                  disabled={!editable}
                  title={editable ? undefined : lockedTitle(r)}
                  onChange={(e) => onCheck(r, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </td>
              <td className="py-2.5 px-3 text-right">
                {editable && (
                  <button
                    onClick={() => onRemove(r._id)}
                    className="p-1 text-gray-300 hover:text-red-500"
                    title="Remove"
                  >
                    <MdDelete size={15} />
                  </button>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <ConfirmDialog
      open={!!confirmRow}
      onClose={() => setConfirmRow(null)}
      onConfirm={() => onToggleAttended(confirmRow._id, true)}
      variant="primary"
      title="Mark as present?"
      message={`Are you sure ${confirmRow?.lead?.name || "this lead"} is present in ${sessionNoun}?`}
      confirmLabel="Yes, mark present"
    />
    </>
  );
}
