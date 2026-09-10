import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MdArrowBack,
  MdEdit,
  MdDelete,
  MdPhone,
  MdEmail,
  MdStorefront,
  MdLocationOn,
  MdPerson,
  MdNoteAdd,
  MdInfoOutline,
  MdAlarmAdd,
  MdAlarm,
  MdClose,
  MdPayments,
  MdUndo,
} from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import LeadFormModal from "./LeadFormModal.jsx";
import LeadWebinars from "./LeadWebinars.jsx";
import ReminderModal from "./ReminderModal.jsx";
import ScheduleCallModal from "../calls/ScheduleCallModal.jsx";
import IfoFormModal from "../ifo/IfoFormModal.jsx";
import ConversionInfoModal from "../ifo/ConversionInfoModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import { ROLES } from "../../utils/roles.js";
import { LEAD_STATUS, LEAD_STATUS_ORDER, LEAD_SOURCE, moveBlocked } from "../../utils/constants.js";
import { fmtDateTime, fmtDateTimeFull, fmtDate, fromNow, inr, initials, pct } from "../../utils/format.js";
import {
  getLead,
  updateLeadStatus,
  undoLeadStatus,
  addRemark,
  deleteLead,
} from "../../services/leadService.js";
import { listReminders, deleteReminder } from "../../services/reminderService.js";
import { listEvents, addInvitees } from "../../services/eventService.js";
import { listWebinars, addRegistrations } from "../../services/webinarService.js";

const REMARK_STYLE = {
  status_change: "border-violet-200 bg-violet-50",
  system: "border-gray-200 bg-gray-50",
  call: "border-blue-200 bg-blue-50",
  payment: "border-green-200 bg-green-50",
  note: "border-gray-200 bg-white",
};

// Closing a lead one of these ways asks for a reason.
const CLOSED_NEGATIVE = ["dead", "invalid"];

export default function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canManage = user.role !== ROLES.SALESPERSON;

  const [note, setNote] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [statusFollowUp, setStatusFollowUp] = useState("");
  const [seatAmount, setSeatAmount] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [ifoOpen, setIfoOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  // Stage changes to "Interested for Zoom 1" / "Interested for event" also let
  // the salesperson pick which session to add the lead to.
  const [webinars, setWebinars] = useState([]);
  const [events, setEvents] = useState([]);
  const [sessionId, setSessionId] = useState("");

  // Poll in the background so remarks, stage changes and reminders set by
  // teammates appear here without a manual refresh.
  const { data, loading, error, reload } = useLiveData(
    () =>
      Promise.all([
        getLead(id),
        // A reminders hiccup shouldn't blank the whole lead page.
        listReminders({ lead: id }).catch(() => ({ items: [] })),
      ]).then(([leadRes, rem]) => ({ ...leadRes, reminders: rem.items || [] })),
    [id]
  );

  // Bounce back to the list only if the very first load fails (lead gone / no access);
  // a hiccup during background polling shouldn't kick the user off the page.
  useEffect(() => {
    if (error && !data) {
      toast.error(error);
      nav("/leads");
    }
  }, [error, data, nav, toast]);

  // Keep the stage stepper aligned with the lead's real status — including when a
  // teammate moves it — without clobbering a selection the user hasn't submitted.
  useEffect(() => {
    if (data?.lead) setNextStatus(data.lead.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.lead?.status]);

  // Short lists to pick from when moving a lead to "Interested for Zoom 1" /
  // "Interested for event" — newest first (the API sorts by date desc).
  // Cancelled sessions are hidden.
  useEffect(() => {
    listWebinars()
      .then((rows) => setWebinars((rows || []).filter((w) => w.status !== "cancelled")))
      .catch(() => {});
    listEvents()
      .then((rows) => setEvents((rows || []).filter((e) => e.status !== "cancelled")))
      .catch(() => {});
  }, []);

  // The session picker is only shown for these two stages.
  const SESSION_STAGES = {
    webinar_interested: {
      list: webinars,
      dateKey: "scheduledAt",
      prompt: "Which Zoom meeting? — adds this lead to the registration list",
      empty: "No Zoom meetings yet — create one under Zoom Meetings.",
      link: (sid) => addRegistrations(sid, [id]),
    },
    event_interested: {
      list: events,
      dateKey: "date",
      prompt: "Which event? — adds this lead to the invitee list",
      empty: "No events yet — create one under Events.",
      link: (sid) => addInvitees(sid, [id]),
    },
  };
  const sessionCfg = SESSION_STAGES[nextStatus] || null;

  // Default the picker to the latest session the moment such a stage is chosen.
  useEffect(() => {
    const cfg = SESSION_STAGES[nextStatus];
    if (cfg && !sessionId && cfg.list.length) setSessionId(cfg.list[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextStatus, webinars, events, sessionId]);

  if (loading || !data) return <Spinner />;
  const { lead, remarks, reminders = [] } = data;

  const removeReminder = async (rid) => {
    try {
      await deleteReminder(rid);
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addRemark(id, note.trim());
      setNote("");
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // "Converted" is never set from the stage stepper — it must go through the
  // record-conversion flow (which asks how much has been paid).
  const pickStatus = (s) => {
    if (s === "converted" && lead.status !== "converted") {
      setIfoOpen(true);
      return;
    }
    setSessionId(""); // let the effect re-default the webinar/event picker for the new stage
    setNextStatus(s);
  };

  const submitStatus = async () => {
    if (nextStatus === lead.status && !statusNote.trim() && !statusFollowUp) return;
    if (nextStatus === "converted" && lead.status !== "converted") {
      setIfoOpen(true);
      return;
    }
    doSubmitStatus();
  };

  const doSubmitStatus = async () => {
    setBusy(true);
    try {
      await updateLeadStatus(id, {
        status: nextStatus,
        note: statusNote.trim() || undefined,
        lostReason: CLOSED_NEGATIVE.includes(nextStatus) ? statusNote.trim() : undefined,
        nextFollowUpDate: statusFollowUp || undefined,
        seatBookingAmount:
          nextStatus === "event_interested" && Number(seatAmount) > 0 ? Number(seatAmount) : undefined,
        eventId: nextStatus === "event_interested" ? sessionId || undefined : undefined,
      });
      // Moving to "Interested for webinar/event" also drops the lead onto that
      // session's list (writes a timeline note; doesn't move the status again).
      if (sessionCfg && sessionId) {
        try {
          await sessionCfg.link(sessionId);
        } catch (err) {
          toast.error(
            typeof err === "string"
              ? err
              : "Stage saved, but the lead couldn't be added to that session."
          );
        }
      }
      setStatusNote("");
      setStatusFollowUp("");
      setSeatAmount("");
      toast.success("Stage updated.");
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // One-step undo of the last stage move — for when a lead was dragged / clicked
  // to the wrong stage. Only offered right after a move (backend `statusRevertable`).
  const prevStage =
    lead.statusRevertable && (lead.statusHistory?.length || 0) >= 2
      ? lead.statusHistory[lead.statusHistory.length - 2].status
      : null;

  const doUndo = async () => {
    setBusy(true);
    try {
      await undoLeadStatus(id);
      toast.success(`Moved back to ${LEAD_STATUS[prevStage]?.label || prevStage}.`);
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/leads" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <MdArrowBack size={16} /> Back to leads
      </Link>

      <PageHeader
        title={lead.name}
        subtitle={lead.restaurantName || undefined}
        actions={
          <>
            <Badge map={LEAD_STATUS} value={lead.status} className="text-sm px-3 py-1" />
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <MdEdit size={16} /> Edit
            </Button>
            {canManage && (
              <Button variant="ghost" onClick={() => setConfirmDel(true)} className="text-red-500">
                <MdDelete size={16} />
              </Button>
            )}
          </>
        }
      />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* Column 1 — contact & context */}
        <div className="space-y-4">
          <Card padding="p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCallOpen(true)}>
                <MdPhone size={14} /> Log a call
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={lead.status === "converted"}
                onClick={() => setIfoOpen(true)}
              >
                Record conversion
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="col-span-2"
                onClick={() => setReminderOpen(true)}
              >
                <MdAlarmAdd size={14} /> Set a reminder
              </Button>
            </div>
          </Card>

          {lead.status === "converted" && lead.dealValue != null && (
            <PaymentCard lead={lead} onOpen={() => setInfoOpen(true)} />
          )}

          {reminders.length > 0 && (
            <Card>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MdAlarm size={16} className="text-gray-400" /> Reminders
              </h3>
              <ul className="space-y-2">
                {reminders.map((r) => {
                  const overdue = new Date(r.remindAt) <= new Date();
                  const forSomeoneElse =
                    r.user?._id && String(r.user._id) !== String(user.id);
                  const isFollowUp = r.kind === "followup";
                  const isInstallment = r.kind === "installment";
                  const isAuto = isFollowUp || isInstallment;
                  return (
                    <li
                      key={r._id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        overdue ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {isFollowUp ? "Follow-up due" : r.note}
                          </p>
                          <p
                            className="text-xs text-gray-400 mt-0.5"
                            title={fmtDateTimeFull(r.remindAt)}
                          >
                            {fmtDateTime(r.remindAt)} · {fromNow(r.remindAt)}
                            {forSomeoneElse ? ` · for ${r.user.name}` : ""}
                            {isFollowUp ? " · from follow-up date" : ""}
                            {isInstallment ? " · from instalment schedule" : ""}
                          </p>
                        </div>
                        {!isAuto && (
                          <button
                            onClick={() => removeReminder(r._id)}
                            className="text-gray-300 hover:text-red-500 shrink-0"
                            aria-label="Delete reminder"
                          >
                            <MdClose size={16} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold text-gray-800 mb-3">Contact</h3>
            <dl className="space-y-2.5 text-sm">
              <Row icon={MdPhone} value={lead.phone} />
              <Row icon={MdEmail} value={lead.email} />
              <Row icon={MdStorefront} value={lead.restaurantName} />
              <Row icon={MdLocationOn} value={[lead.city, lead.state].filter(Boolean).join(", ")} />
              <Row icon={MdPerson} value={lead.assignedTo?.name} label="Owner" />
            </dl>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
              <Meta label="Source" value={LEAD_SOURCE[lead.source]?.label || lead.source} />
              {lead.status === "converted" && lead.dealValue != null ? (
                <Meta
                  label={
                    <span className="inline-flex items-center gap-1">
                      Deal value
                      {lead.conversionId && (
                        <button
                          onClick={() => setInfoOpen(true)}
                          className="text-gray-300 hover:text-primary-dark"
                          title="Payment history"
                        >
                          <MdInfoOutline size={13} />
                        </button>
                      )}
                    </span>
                  }
                  value={<span className="text-green-600 font-semibold">{inr(lead.dealValue)}</span>}
                />
              ) : (
                <Meta label="Potential" value={lead.potentialValue ? inr(lead.potentialValue) : "—"} />
              )}
              <Meta label="Next follow-up" value={lead.nextFollowUpDate ? fmtDate(lead.nextFollowUpDate) : "—"} />
              <Meta label="Added" value={fmtDate(lead.createdAt)} />
              {lead.seatBooking && (
                <Meta
                  label="Event seat booking"
                  value={<span className="text-emerald-700 font-semibold">{inr(lead.seatBooking.amount)}</span>}
                />
              )}
            </div>
            {CLOSED_NEGATIVE.includes(lead.status) && lead.lostReason && (
              <p className="mt-3 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                {LEAD_STATUS[lead.status].label}: {lead.lostReason}
              </p>
            )}
          </Card>
        </div>

        {/* Column 2 — move the lead through the pipeline */}
        <div className="space-y-4">
        <Card padding="p-4">
          <h3 className="font-bold text-gray-900 mb-3">Move stage</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {LEAD_STATUS_ORDER.map((s) => {
                const blocked = moveBlocked(lead.status, s, lead.statusHistory);
                const selected = nextStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => pickStatus(s)}
                    disabled={!!blocked}
                    title={blocked || undefined}
                    className={`text-xs px-3 py-1.5 rounded-full font-bold border transition ${
                      blocked
                        ? "bg-gray-100 text-gray-400 border-gray-100 opacity-50 cursor-not-allowed"
                        : selected
                        ? `${LEAD_STATUS[s].color} border-transparent ring-2 ring-offset-1 ring-gray-800 shadow-sm`
                        : `${LEAD_STATUS[s].color} border-transparent hover:opacity-80`
                    }`}
                  >
                    {LEAD_STATUS[s].label}
                  </button>
                );
              })}
            </div>
            {LEAD_STATUS_ORDER.some((s) => moveBlocked(lead.status, s, lead.statusHistory)) && (
              <p className="mb-3 text-xs font-semibold text-amber-700">
                {lead.status === "followup"
                  ? "Leads move forward only — resume this one at the stage it reached, or move it on."
                  : "Leads move forward only. If this one has stalled, move it to Follow-up."}
              </p>
            )}
            {prevStage && (
              <button
                onClick={doUndo}
                disabled={busy}
                className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <MdUndo size={14} /> Undo last change — back to{" "}
                <b>{LEAD_STATUS[prevStage]?.label || prevStage}</b>
              </button>
            )}
            {sessionCfg && (
              <label className="block mb-3">
                <span className="text-xs font-semibold text-gray-500">{sessionCfg.prompt}</span>
                {sessionCfg.list.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-400">{sessionCfg.empty}</p>
                ) : (
                  <Listbox
                    className="w-full mt-1"
                    value={sessionId}
                    onChange={setSessionId}
                    options={[
                      ...sessionCfg.list.map((s, i) => ({
                        value: s._id,
                        label: `${s.title} · ${fmtDate(s[sessionCfg.dateKey])}${i === 0 ? "  (latest)" : ""}`,
                      })),
                      { value: "", label: "— don't link to a session —" },
                    ]}
                  />
                )}
              </label>
            )}
            {nextStatus === "event_interested" && !lead.seatBooking && (
              <label className="block mb-3">
                <span className="text-xs font-semibold text-gray-500">
                  Event seat booking (₹) — optional
                </span>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  inputMode="numeric"
                  value={seatAmount}
                  onChange={(e) => setSeatAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="block text-xs text-gray-400 mt-1">
                  Amount collected to reserve their seat (max ₹10,000). Shows on the dashboard.
                </span>
              </label>
            )}
            {nextStatus === "event_interested" && lead.seatBooking && (
              <p className="mb-3 text-xs font-semibold text-emerald-700">
                Seat already booked — {inr(lead.seatBooking.amount)} collected.
              </p>
            )}
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={2}
              placeholder={
                CLOSED_NEGATIVE.includes(nextStatus)
                  ? `Why is this lead ${LEAD_STATUS[nextStatus].label}? (optional)`
                  : "Remark — what changed / what's next? (optional)"
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {!CLOSED_NEGATIVE.includes(nextStatus) && (
              <label className="block mt-2">
                <span className="text-xs text-gray-500">Next follow-up date (optional)</span>
                <input
                  type="date"
                  value={statusFollowUp}
                  onChange={(e) => setStatusFollowUp(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            )}
            <Button
              onClick={submitStatus}
              disabled={busy || (nextStatus === lead.status && !statusNote.trim() && !statusFollowUp)}
              className="mt-2 w-full"
            >
              Update stage
            </Button>
        </Card>

        {/* Only while the lead is parked at "Zoom 1 Attended" — a lead only
            moves on to Zoom 2 if they actually sat through Zoom 1. Also hides
            the moment a different next stage is picked above (moving on). */}
        {lead.status === "webinar_attended" && nextStatus === "webinar_attended" && (
          <LeadWebinars lead={lead} allWebinars={webinars} onChange={reload} />
        )}
        </div>

        {/* Column 3 — activity timeline */}
        <Card padding="p-4" className="md:col-span-2 xl:col-span-1">
          <h3 className="font-semibold text-gray-800 mb-3">Activity</h3>
          <div className="flex gap-2 mb-5">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a remark…"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button onClick={submitNote} disabled={busy || !note.trim()} className="self-end">
              <MdNoteAdd size={16} /> Add
            </Button>
          </div>

          <ol className="space-y-3">
            {remarks.map((r) => (
              <li key={r._id} className={`rounded-lg border px-3 py-2.5 ${REMARK_STYLE[r.type] || REMARK_STYLE.note}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <span className="h-5 w-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px]">
                      {initials(r.author?.name || "?")}
                    </span>
                    {r.author?.name || "System"}
                  </span>
                  <span className="text-right shrink-0 leading-tight" title={fmtDateTimeFull(r.createdAt)}>
                    <span className="block text-xs text-gray-500">{fmtDateTime(r.createdAt)}</span>
                    <span className="block text-[11px] text-gray-400">{fromNow(r.createdAt)}</span>
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{r.text}</p>
                {r.updatedAt && new Date(r.updatedAt) - new Date(r.createdAt) > 1000 && (
                  <p
                    className="mt-1 text-[11px] italic text-gray-400"
                    title={fmtDateTimeFull(r.updatedAt)}
                  >
                    edited {fmtDateTime(r.updatedAt)} · {fromNow(r.updatedAt)}
                  </p>
                )}
              </li>
            ))}
            {remarks.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No activity yet.</p>}
          </ol>
        </Card>
      </div>

      <LeadFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={reload} lead={lead} />
      <ReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        onSaved={reload}
        lead={lead}
      />
      <ScheduleCallModal
        open={callOpen}
        onClose={() => setCallOpen(false)}
        onDone={reload}
        fixedLead={{ _id: lead._id, name: lead.name }}
      />
      <IfoFormModal
        open={ifoOpen}
        onClose={() => setIfoOpen(false)}
        onSaved={reload}
        presetLead={lead}
      />
      <ConversionInfoModal
        open={infoOpen}
        conversionId={lead.conversionId}
        onClose={() => setInfoOpen(false)}
        onChanged={reload}
      />
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => {
          await deleteLead(id);
          toast.success("Lead deleted.");
          nav("/leads");
        }}
        title={`Delete ${lead.name}?`}
        message="This removes the lead and its entire activity history."
        confirmLabel="Delete lead"
      />
    </div>
  );
}

function PaymentCard({ lead, onOpen }) {
  const deal = lead.dealValue || 0;
  const paid = lead.amountReceived || 0;
  const outstanding = Math.max(0, deal - paid);
  const p = pct(paid, deal);
  const nextOverdue = lead.nextInstallmentDate && new Date(lead.nextInstallmentDate) < new Date();

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Payment</h3>
        {lead.conversionId && (
          <button onClick={onOpen} className="text-xs text-primary-dark hover:underline">
            History / record
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm mb-2">
        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Deal</p>
          <p className="font-semibold text-gray-800">{inr(deal)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Received</p>
          <p className={`font-semibold ${paid > 0 ? "text-green-600" : "text-gray-400"}`}>{inr(paid)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Outstanding</p>
          <p className={`font-semibold ${outstanding > 0 ? "text-amber-600" : "text-gray-400"}`}>
            {inr(outstanding)}
          </p>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${p >= 100 ? "bg-green-500" : p > 0 ? "bg-amber-500" : "bg-gray-300"}`}
          style={{ width: `${Math.min(100, Math.max(p, paid > 0 ? 3 : 0))}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {p}% collected
        {paid === 0 && <span className="text-amber-600 font-medium"> · nothing paid yet</span>}
      </p>
      {lead.nextInstallmentDate && (
        <p className={`text-xs mt-1 ${nextOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
          Next instalment {nextOverdue ? "was due" : "due"} {fmtDate(lead.nextInstallmentDate)}
          {lead.nextInstallmentAmount ? ` · ${inr(lead.nextInstallmentAmount)}` : ""}
        </p>
      )}
      {outstanding > 0 && lead.conversionId && (
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onOpen}>
          <MdPayments size={14} /> Record a payment
        </Button>
      )}
    </Card>
  );
}

function Row({ icon: Icon, value, label }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <Icon size={16} className="text-gray-400 shrink-0" />
      <span>
        {label && <span className="text-gray-400">{label}: </span>}
        {value}
      </span>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  );
}
