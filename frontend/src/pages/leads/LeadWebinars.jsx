import { useEffect, useMemo, useState } from "react";
import { MdVideocam, MdAdd, MdCheckCircle, MdRadioButtonUnchecked } from "react-icons/md";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { fmtDate } from "../../utils/format.js";
import { addRegistrations, setAttendance } from "../../services/webinarService.js";

// Shown only on the "Zoom 1 Attended" stage. When a lead sat through Zoom 1 but
// didn't get the topic, they get put on another Zoom (2, 3…). That's tracked
// here — each Zoom meeting with its own attendance tick — and the lead's
// pipeline STAGE does not move, it stays at "Zoom 1 Attended".
export default function LeadWebinars({ lead, allWebinars, onChange }) {
  const toast = useToast();
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmW, setConfirmW] = useState(null);

  const linked = lead.webinars || [];
  const options = useMemo(() => {
    const has = new Set(linked.map((w) => String(w.webinarId)));
    return (allWebinars || []).filter((w) => !has.has(String(w._id)));
  }, [allWebinars, linked]);

  // Default the picker to whichever Zoom meeting is coming up soonest (the
  // list is already sorted that way — see LeadDetail's byNearestFirst).
  useEffect(() => {
    if (options.length && !options.some((o) => o._id === adding)) setAdding(options[0]._id);
    else if (!options.length && adding) setAdding("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const add = async () => {
    if (!adding) return;
    setBusy(true);
    try {
      await addRegistrations(adding, [lead._id]);
      setAdding("");
      toast.success("Added to the Zoom meeting.");
      await onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const setAttended = async (w, val) => {
    setBusy(true);
    try {
      await setAttendance(w.webinarId, w.regId, val);
      await onChange();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Marking present asks first; un-marking goes straight through.
  const toggle = (w) => (w.attended ? setAttended(w, false) : setConfirmW(w));

  return (
    <Card padding="p-4">
      <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <MdVideocam size={16} className="text-gray-400" /> Zoom meetings
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        Didn't get the topic in Zoom 1? Put them on another Zoom — the stage stays here.
      </p>

      {linked.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">Not on any Zoom meeting yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {linked.map((w) => (
            <li key={w.webinarId} className="rounded-lg border border-gray-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{w.title}</p>
                  <p className="text-xs text-gray-400">{fmtDate(w.scheduledAt)}</p>
                </div>
                <button
                  onClick={() => toggle(w)}
                  disabled={busy}
                  title="Toggle attendance"
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold disabled:opacity-60 ${
                    w.attended
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {w.attended ? <MdCheckCircle size={13} /> : <MdRadioButtonUnchecked size={13} />}
                  {w.attended ? "Attended" : "Mark attended"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 ? (
        <div className="flex gap-2">
          <Listbox
            className="flex-1 min-w-0"
            value={adding}
            onChange={setAdding}
            options={[
              { value: "", label: "Add another Zoom meeting…" },
              ...options.map((w, i) => ({
                value: w._id,
                label: `${w.title} · ${fmtDate(w.scheduledAt)}${i === 0 ? "  (next up)" : ""}`,
              })),
            ]}
          />
          <Button onClick={add} disabled={busy || !adding} size="sm">
            <MdAdd size={16} /> Add
          </Button>
        </div>
      ) : (
        linked.length > 0 && (
          <p className="text-xs text-gray-400">Added to every Zoom meeting.</p>
        )
      )}

      <ConfirmDialog
        open={!!confirmW}
        onClose={() => setConfirmW(null)}
        onConfirm={() => setAttended(confirmW, true)}
        variant="primary"
        title="Mark as present?"
        message={`Are you sure ${lead.name} attended "${confirmW?.title}"?`}
        confirmLabel="Yes, mark present"
      />
    </Card>
  );
}
