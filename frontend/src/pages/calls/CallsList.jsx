import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MdAdd, MdCheckCircle, MdPhone, MdOutlineWatchLater } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import CompleteCallModal from "./CompleteCallModal.jsx";
import ScheduleCallModal from "./ScheduleCallModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CALL_STATUS, CALL_OUTCOME } from "../../utils/constants.js";
import { fmtDateTime, fromNow } from "../../utils/format.js";
import { listCalls, getToday } from "../../services/callService.js";

const TABS = [
  { key: "today", label: "Today & overdue" },
  { key: "scheduled", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export default function CallsList() {
  const toast = useToast();
  const [tab, setTab] = useState("today");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ today: [], overdue: [] });
  const [list, setList] = useState({ data: [], total: 0, page: 1, pages: 1 });
  const [toComplete, setToComplete] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "today") {
        setToday(await getToday());
      } else {
        const params = { page, limit: 20 };
        if (tab !== "all") params.status = tab;
        setList(await listCalls(params));
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const CallRow = ({ call, overdue }) => (
    <div className="flex items-center justify-between gap-3 py-3 px-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <Link to={`/leads/${call.lead?._id}`} className="font-medium text-gray-800 hover:text-primary-dark">
          {call.lead?.name || "—"}
        </Link>
        <p className="text-xs text-gray-400 truncate">
          {call.lead?.restaurantName || call.lead?.phone} · {call.calledBy?.name}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
          {overdue ? `Overdue ${fromNow(call.scheduledAt)}` : fmtDateTime(call.scheduledAt)}
        </span>
        {call.status === "completed" ? (
          <Badge color="bg-green-100 text-green-700">
            {CALL_OUTCOME[call.outcome]?.label || "Done"}
          </Badge>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setToComplete(call)}>
            <MdCheckCircle size={14} /> Log
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Calls"
        subtitle="Your calling worklist across the pipeline."
        actions={
          <Button onClick={() => setScheduleOpen(true)}>
            <MdAdd size={18} /> Schedule call
          </Button>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => { setTab(k); setPage(1); }} />

      <div className="mt-4">
        {loading ? (
          <Spinner />
        ) : tab === "today" ? (
          <div className="space-y-5">
            <Section
              icon={MdOutlineWatchLater}
              title={`Overdue (${today.overdue.length})`}
              empty="Nothing overdue — nice."
              rows={today.overdue}
              render={(c) => <CallRow key={c._id} call={c} overdue />}
            />
            <Section
              icon={MdPhone}
              title={`Today (${today.today.length})`}
              empty="No calls scheduled for today."
              rows={today.today}
              render={(c) => <CallRow key={c._id} call={c} />}
            />
          </div>
        ) : (
          <Card padding="p-2">
            {list.data.length === 0 ? (
              <EmptyState title="No calls here" />
            ) : (
              list.data.map((c) => <CallRow key={c._id} call={c} />)
            )}
            <div className="px-2">
              <Pagination page={list.page} pages={list.pages} total={list.total} onChange={setPage} />
            </div>
          </Card>
        )}
      </div>

      <CompleteCallModal
        open={!!toComplete}
        call={toComplete}
        onClose={() => setToComplete(null)}
        onDone={load}
      />
      <ScheduleCallModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} onDone={load} />
    </div>
  );
}

function Section({ icon: Icon, title, rows, render, empty }) {
  return (
    <Card padding="p-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
        <Icon size={16} className="text-gray-400" /> {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6">{empty}</p>
      ) : (
        <div>{rows.map(render)}</div>
      )}
    </Card>
  );
}
