import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdOutlineAssignment,
  MdTrendingUp,
  MdOutlineMonetizationOn,
  MdEmojiEvents,
  MdPhone,
  MdVideocam,
  MdEvent,
  MdChevronRight,
} from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import LeadStageSelect from "../../components/LeadStageSelect.jsx";
import useStageChange from "../../hooks/useStageChange.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ryg } from "../../utils/calculations.js";
import { inrCompact, fmtDate, firstName, MONTHS } from "../../utils/format.js";
import { getSummary, getMyTasks } from "../../services/dashboardService.js";
import { getMyTarget } from "../../services/targetService.js";

const METRIC_LABEL = { leadTarget: "Leads", callTarget: "Calls", conversionTarget: "Conversions", revenueTarget: "Revenue" };

export default function SalesDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    Promise.all([getSummary(), getMyTasks(), getMyTarget()])
      .then(([summary, tasks, target]) => setData({ summary, tasks, target }))
      .catch((err) => toast.error(err));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stage = useStageChange(load);

  if (!data) return <Spinner />;
  const { summary, tasks, target } = data;

  // Last-30-days actuals vs the monthly target — a rough pace check.
  const progress = [
    { key: "conversionTarget", actual: summary.recentConversions, target: target.conversionTarget },
    { key: "revenueTarget", actual: summary.recentRevenue, target: target.revenueTarget, money: true },
  ];

  return (
    <div>
      <PageHeader title={`Hi ${firstName(user.name)}`} subtitle={`Your pipeline for ${MONTHS[new Date().getMonth()]}.`} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="My leads" value={summary.totalLeads} icon={MdOutlineAssignment} hint={`${summary.openFollowUps} follow-ups due`} />
        <StatCard label="Conversion rate" value={`${summary.conversionRate}%`} icon={MdTrendingUp} hint={`${summary.converted} won`} />
        <StatCard label="My revenue" value={inrCompact(summary.totalRevenue)} icon={MdOutlineMonetizationOn} hint={`${summary.totalConversions} conversions`} />
        <StatCard
          label="Leaderboard rank"
          value={summary.myRank ? `#${summary.myRank}` : "—"}
          icon={MdEmojiEvents}
          accent="text-amber-500"
          hint={summary.teamSize ? `of ${summary.teamSize} · ${summary.myScore} pts` : ""}
        />
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        {/* Target progress */}
        <Card>
          <h3 className="font-bold text-gray-800 mb-4">Last 30 days vs target</h3>
          <div className="space-y-4">
            {progress.map((p) => {
              const r = ryg(p.actual, p.target);
              const width = p.target ? Math.min(100, Math.round((p.actual / p.target) * 100)) : 0;
              return (
                <div key={p.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{METRIC_LABEL[p.key]}</span>
                    <span className="font-semibold text-gray-600">
                      {p.money ? inrCompact(p.actual) : p.actual}
                      <span className="font-medium text-gray-400"> / {p.money ? inrCompact(p.target) : p.target || "—"}</span>
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        r.key === "green" ? "bg-green-500" : r.key === "yellow" ? "bg-amber-500" : r.key === "red" ? "bg-red-500" : "bg-gray-300"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!target.conversionTarget && !target.revenueTarget && (
              <p className="text-xs font-semibold text-gray-500">No target set for this month yet.</p>
            )}
          </div>
        </Card>

        {/* Today's follow-ups */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Follow-ups due</h3>
            <span className="text-xs font-semibold text-gray-500">
              {tasks.callsToday} calls today · {tasks.overdueCalls} overdue
            </span>
          </div>
          {tasks.followUps.length === 0 ? (
            <EmptyState title="All caught up" message="No follow-ups due today." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {tasks.followUps.map((l) => (
                <li
                  key={l._id}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded"
                >
                  <button
                    type="button"
                    onClick={() => nav(`/leads/${l._id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-bold text-gray-800 truncate">{l.name}</p>
                    <p className="text-xs font-medium text-gray-500 truncate">
                      {l.restaurantName || l.phone}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <LeadStageSelect lead={l} onPick={stage.trigger} />
                    <span className="text-xs text-gray-400">{fmtDate(l.nextFollowUpDate)}</span>
                    <button
                      type="button"
                      onClick={() => nav(`/leads/${l._id}`)}
                      aria-label="Open lead"
                    >
                      <MdChevronRight className="text-gray-300" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Upcoming sessions */}
      {(tasks.upcomingWebinars.length > 0 || tasks.upcomingEvents.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-5 mt-5">
          <Card>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <MdVideocam size={18} className="text-gray-400" /> Upcoming Zoom meetings
            </h3>
            <ul className="space-y-2 text-sm">
              {tasks.upcomingWebinars.map((w) => (
                <li key={w._id} className="flex justify-between">
                  <span className="font-semibold text-gray-700">{w.title}</span>
                  <span className="font-medium text-gray-500">{fmtDate(w.scheduledAt)}</span>
                </li>
              ))}
              {tasks.upcomingWebinars.length === 0 && <li className="font-medium text-gray-400">None scheduled.</li>}
            </ul>
          </Card>
          <Card>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <MdEvent size={18} className="text-gray-400" /> Upcoming events
            </h3>
            <ul className="space-y-2 text-sm">
              {tasks.upcomingEvents.map((e) => (
                <li key={e._id} className="flex justify-between">
                  <span className="font-semibold text-gray-700">{e.title}</span>
                  <span className="font-medium text-gray-500">{fmtDate(e.date)}</span>
                </li>
              ))}
              {tasks.upcomingEvents.length === 0 && <li className="font-medium text-gray-400">None scheduled.</li>}
            </ul>
          </Card>
        </div>
      )}

      {stage.modals}
    </div>
  );
}
