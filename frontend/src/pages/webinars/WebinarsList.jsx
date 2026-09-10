import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdAdd, MdVideocam, MdGroups, MdHowToReg } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import WebinarFormModal from "./WebinarFormModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { WEBINAR_STATUS } from "../../utils/constants.js";
import { fmtDateTime, pct } from "../../utils/format.js";
import { listWebinars } from "../../services/webinarService.js";

export default function WebinarsList() {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canManage = user.role !== ROLES.SALESPERSON;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listWebinars());
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Zoom Meetings"
        subtitle="Online sessions and who showed up."
        actions={
          canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <MdAdd size={18} /> New Zoom meeting
            </Button>
          )
        }
      />

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={MdVideocam} title="No Zoom meetings yet" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((w) => (
            <button
              key={w._id}
              onClick={() => nav(`/webinars/${w._id}`)}
              className="text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-primary/40 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-800 leading-tight">{w.title}</h3>
                <Badge map={WEBINAR_STATUS} value={w.status} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{fmtDateTime(w.scheduledAt)}</p>
              {w.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{w.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <MdGroups size={16} className="text-gray-400" /> {w.registrationCount} registered
                </span>
                {w.status === "completed" && (
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <MdHowToReg size={16} className="text-gray-400" /> {w.attendedCount} attended
                    <span className="text-gray-400">({pct(w.attendedCount, w.registrationCount)}%)</span>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <WebinarFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  );
}
