import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { Input, Textarea } from "../../components/ui/Field.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { LEAD_STATUS } from "../../utils/constants.js";
import { fmtDate } from "../../utils/format.js";
import { updateLeadStatus } from "../../services/leadService.js";
import { listWebinars, addRegistrations } from "../../services/webinarService.js";
import { listEvents, addInvitees } from "../../services/eventService.js";

// Moving a lead to one of these stages also lets the salesperson pick which
// webinar/event to add them to (newest first, "latest" pre-selected).
const SESSION_STAGE = {
  webinar_interested: {
    load: listWebinars,
    dateKey: "scheduledAt",
    label: "Which Zoom meeting?",
    hint: "Adds this lead to the Zoom meeting's registration list.",
    empty: "No Zoom meetings yet — create one under Zoom Meetings.",
    link: (sid, leadId) => addRegistrations(sid, [leadId]),
  },
  event_interested: {
    load: listEvents,
    dateKey: "date",
    label: "Which event?",
    hint: "Adds this lead to the event's invitee list.",
    empty: "No events yet — create one under Events.",
    link: (sid, leadId) => addInvitees(sid, [leadId]),
  },
};

// Shown every time a lead's stage changes (from the Kanban). Always asks for a
// remark — optional, but it's what keeps the "why did this move" trail — plus
// an optional next follow-up date, and (for the webinar/event stages) which
// session to register the lead for.
export default function StatusChangeModal({ open, onClose, lead, toStatus, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");

  const negative = toStatus === "dead" || toStatus === "invalid";
  const sessionCfg = SESSION_STAGE[toStatus] || null;

  useEffect(() => {
    if (!open) return;
    setNote("");
    setFollowUp(lead?.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : "");
  }, [open, lead]);

  // Load the webinar / event list when moving to a session stage; default the
  // picker to the latest one.
  useEffect(() => {
    if (!open || !sessionCfg) {
      setSessions([]);
      setSessionId("");
      return;
    }
    let alive = true;
    sessionCfg
      .load()
      .then((rows) => {
        if (!alive) return;
        const list = (rows || []).filter((s) => s.status !== "cancelled");
        setSessions(list);
        setSessionId(list[0]?._id || "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, toStatus]);

  const submit = async () => {
    setBusy(true);
    try {
      await updateLeadStatus(lead._id, {
        status: toStatus,
        note: note.trim() || undefined,
        lostReason: negative ? note.trim() || undefined : undefined,
        nextFollowUpDate: followUp || undefined,
      });
      // Best-effort: register / invite the lead for the picked session. A
      // failure here only warns — the stage change is already saved.
      if (sessionCfg && sessionId) {
        try {
          await sessionCfg.link(sessionId, lead._id);
        } catch (err) {
          toast.error(
            typeof err === "string"
              ? err
              : "Stage saved, but the lead couldn't be added to that session."
          );
        }
      }
      toast.success(`Moved to ${LEAD_STATUS[toStatus]?.label}.`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          Move to <Badge map={LEAD_STATUS} value={toStatus} className="text-sm px-2.5 py-0.5" />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Update stage"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          <b className="text-gray-800">{lead?.name}</b>
          {lead?.restaurantName ? ` · ${lead.restaurantName}` : ""}
        </p>

        {sessionCfg &&
          (sessions.length === 0 ? (
            <p className="text-sm text-gray-400">{sessionCfg.empty}</p>
          ) : (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">{sessionCfg.label}</span>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {sessions.map((s, i) => (
                  <option key={s._id} value={s._id}>
                    {s.title} · {fmtDate(s[sessionCfg.dateKey])}
                    {i === 0 ? "  (latest)" : ""}
                  </option>
                ))}
                <option value="">— don't link to a session —</option>
              </select>
              <span className="block text-xs text-gray-400 mt-1">{sessionCfg.hint}</span>
            </label>
          ))}

        <Textarea
          label="Remark"
          hint="Optional — kept on the timeline so anyone can see why the stage changed."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={
            negative
              ? "Why is this lead being closed? (optional)"
              : "What changed / what's the plan? e.g. “Owner keen, sending quote”"
          }
        />
        {!negative && (
          <Input
            label="Next follow-up date"
            hint="Optional"
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
