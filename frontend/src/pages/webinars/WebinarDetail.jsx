import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MdArrowBack, MdEdit, MdDelete, MdPersonAdd } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import LeadPicker from "../../components/LeadPicker.jsx";
import AttendeeTable from "../../components/AttendeeTable.jsx";
import WebinarFormModal from "./WebinarFormModal.jsx";
import useStageChange from "../../hooks/useStageChange.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { WEBINAR_STATUS } from "../../utils/constants.js";
import { fmtDateTime, pct } from "../../utils/format.js";
import {
  getWebinar,
  addRegistrations,
  setAttendance,
  removeRegistration,
  deleteWebinar,
} from "../../services/webinarService.js";

export default function WebinarDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canManage = user.role !== ROLES.SALESPERSON;

  const [w, setW] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setW(await getWebinar(id));
    } catch (err) {
      toast.error(err);
      nav("/webinars");
    } finally {
      setLoading(false);
    }
  }, [id, nav, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stage = useStageChange(load);

  if (loading || !w) return <Spinner />;

  const attended = w.registrations.filter((r) => r.attended).length;

  const addLeads = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await addRegistrations(id, picked.map((l) => l._id));
      setPicked([]);
      toast.success("Leads registered.");
      await load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/webinars" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <MdArrowBack size={16} /> Back to Zoom meetings
      </Link>

      <PageHeader
        title={w.title}
        subtitle={fmtDateTime(w.scheduledAt)}
        actions={
          <>
            <Badge map={WEBINAR_STATUS} value={w.status} className="text-sm px-3 py-1" />
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

      {w.description && <p className="text-sm text-gray-600 mb-4 max-w-2xl">{w.description}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Registered" value={w.registrations.length} />
        <StatCard label="Attended" value={attended} hint={`${pct(attended, w.registrations.length)}% turnout`} />
        <StatCard label="Host" value={w.host?.name || "—"} />
      </div>

      {canManage && (
        <Card className="mb-4">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <MdPersonAdd size={18} className="text-gray-400" /> Add leads
          </h3>
          <LeadPicker multiple value={picked} onChange={setPicked} placeholder="Search leads to register…" />
          <Button onClick={addLeads} disabled={busy || !picked.length} className="mt-3">
            Register {picked.length || ""} lead{picked.length === 1 ? "" : "s"}
          </Button>
        </Card>
      )}

      <Card padding="p-2">
        <AttendeeTable
          rows={w.registrations}
          sessionNoun="this Zoom meeting"
          onStageChange={stage.trigger}
          onToggleAttended={async (regId, val) => {
            await setAttendance(id, regId, val);
            load();
          }}
          onRemove={async (regId) => {
            await removeRegistration(id, regId);
            load();
          }}
        />
      </Card>

      {stage.modals}

      <WebinarFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} webinar={w} />
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => {
          await deleteWebinar(id);
          toast.success("Zoom meeting deleted.");
          nav("/webinars");
        }}
        title={`Delete “${w.title}”?`}
        message="This removes the Zoom meeting and its registration list."
        confirmLabel="Delete"
      />
    </div>
  );
}
