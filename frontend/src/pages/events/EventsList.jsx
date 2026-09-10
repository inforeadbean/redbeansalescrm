import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdAdd, MdEvent, MdGroups, MdHowToReg, MdLocationOn } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import EventFormModal from "./EventFormModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../utils/roles.js";
import { EVENT_STATUS } from "../../utils/constants.js";
import { fmtDateTime, pct } from "../../utils/format.js";
import { listEvents } from "../../services/eventService.js";

export default function EventsList() {
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
      setRows(await listEvents());
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
        title="Events"
        subtitle="In-person meetups, tastings and summits."
        actions={
          canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <MdAdd size={18} /> New event
            </Button>
          )
        }
      />

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={MdEvent} title="No events yet" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <button
              key={e._id}
              onClick={() => nav(`/events/${e._id}`)}
              className="text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-primary/40 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-800 leading-tight">{e.title}</h3>
                <Badge map={EVENT_STATUS} value={e.status} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{fmtDateTime(e.date)}</p>
              {(e.venue || e.city) && (
                <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <MdLocationOn size={13} /> {[e.venue, e.city].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <MdGroups size={16} className="text-gray-400" /> {e.inviteeCount} invited
                </span>
                {e.status === "completed" && (
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <MdHowToReg size={16} className="text-gray-400" /> {e.attendedCount} came
                    <span className="text-gray-400">({pct(e.attendedCount, e.inviteeCount)}%)</span>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <EventFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  );
}
