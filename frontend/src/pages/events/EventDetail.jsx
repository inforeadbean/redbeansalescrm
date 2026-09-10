import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MdArrowBack, MdEdit, MdDelete, MdPersonAdd, MdLocationOn } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import LeadPicker from "../../components/LeadPicker.jsx";
import AttendeeTable from "../../components/AttendeeTable.jsx";
import EventFormModal from "./EventFormModal.jsx";
import useStageChange from "../../hooks/useStageChange.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { EVENT_STATUS } from "../../utils/constants.js";
import { fmtDateTime, pct } from "../../utils/format.js";
import {
  getEvent,
  addInvitees,
  setInvitee,
  removeInvitee,
  deleteEvent,
} from "../../services/eventService.js";

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canManage = user.role !== ROLES.SALESPERSON;

  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEv(await getEvent(id));
    } catch (err) {
      toast.error(err);
      nav("/events");
    } finally {
      setLoading(false);
    }
  }, [id, nav, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stage = useStageChange(load);

  if (loading || !ev) return <Spinner />;

  const attended = ev.invitees.filter((i) => i.attended).length;
  const confirmed = ev.invitees.filter((i) => i.rsvp === "confirmed").length;

  const addLeads = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await addInvitees(id, picked.map((l) => l._id));
      setPicked([]);
      toast.success("Leads invited.");
      await load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <MdArrowBack size={16} /> Back to events
      </Link>

      <PageHeader
        title={ev.title}
        subtitle={fmtDateTime(ev.date)}
        actions={
          <>
            <Badge map={EVENT_STATUS} value={ev.status} className="text-sm px-3 py-1" />
            {canManage && (
              <>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <MdEdit size={16} /> Edit
                </Button>
                <Button variant="ghost" className="text-red-500" onClick={() => setConfirmDel(true)}>
                  <MdDelete size={16} />
                </Button>
              </>
            )}
          </>
        }
      />

      {(ev.venue || ev.city) && (
        <p className="flex items-center gap-1 text-sm text-gray-600 mb-1">
          <MdLocationOn size={15} className="text-gray-400" /> {[ev.venue, ev.city].filter(Boolean).join(", ")}
        </p>
      )}
      {ev.description && <p className="text-sm text-gray-600 mb-4 max-w-2xl">{ev.description}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatCard label="Invited" value={ev.invitees.length} />
        <StatCard label="Confirmed" value={confirmed} />
        <StatCard label="Attended" value={attended} hint={`${pct(attended, ev.invitees.length)}% turnout`} />
        <StatCard label="Host" value={ev.host?.name || "—"} />
      </div>

      {canManage && (
        <Card className="mb-4">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <MdPersonAdd size={18} className="text-gray-400" /> Invite leads
          </h3>
          <LeadPicker multiple value={picked} onChange={setPicked} placeholder="Search leads to invite…" />
          <Button onClick={addLeads} disabled={busy || !picked.length} className="mt-3">
            Invite {picked.length || ""} lead{picked.length === 1 ? "" : "s"}
          </Button>
        </Card>
      )}

      <Card padding="p-2">
        <AttendeeTable
          rows={ev.invitees}
          onStageChange={stage.trigger}
          onRsvp={async (inviteeId, rsvp) => {
            await setInvitee(id, inviteeId, { rsvp });
            load();
          }}
          onToggleAttended={async (inviteeId, attended) => {
            await setInvitee(id, inviteeId, { attended });
            load();
          }}
          onRemove={async (inviteeId) => {
            await removeInvitee(id, inviteeId);
            load();
          }}
        />
      </Card>

      {stage.modals}

      <EventFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} event={ev} />
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => {
          await deleteEvent(id);
          toast.success("Event deleted.");
          nav("/events");
        }}
        title={`Delete “${ev.title}”?`}
        message="This removes the event and its invitee list."
        confirmLabel="Delete"
      />
    </div>
  );
}
