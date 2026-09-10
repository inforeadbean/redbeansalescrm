import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MdOutlineAssignment,
  MdOutlineGroups,
  MdOutlineHandshake,
  MdTrendingUp,
  MdOutlineMonetizationOn,
  MdOutlineFilterAlt,
  MdEmojiEvents,
  MdOutlineInsights,
} from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import SectionLabel from "../../components/SectionLabel.jsx";
import MonthPicker from "../../components/MonthPicker.jsx";
import SalespersonPicker from "../../components/SalespersonPicker.jsx";
import BarList from "../../components/charts/BarList.jsx";
import TrendLine from "../../components/charts/TrendLine.jsx";
import MiniBars from "../../components/charts/MiniBars.jsx";
import DonutChart from "../../components/charts/DonutChart.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { LEAD_STATUS, LEAD_STATUS_ORDER } from "../../utils/constants.js";
import { inrCompact, MONTHS } from "../../utils/format.js";
import { getSummary, getFunnel, getTrends, getTeamPipeline } from "../../services/dashboardService.js";
import { getLeaderboard } from "../../services/reportService.js";
import { getAssignable } from "../../services/userService.js";

// Admin (company-wide) and Sales-Head (team) dashboard. Every number is scoped
// by the caller's role on the API; a month slicer and an optional per-person
// slicer drive the KPI row and stage split. Trends stay wide (8 weeks / 5
// months) as context.
export default function ExecutiveDashboard({ title, subtitle }) {
  const toast = useToast();
  const nav = useNavigate();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [salespersonId, setSalespersonId] = useState("");
  const [people, setPeople] = useState([]);
  const [core, setCore] = useState(null);
  const [wide, setWide] = useState(null);

  useEffect(() => {
    getAssignable()
      .then((rows) => setPeople(rows.filter((u) => u.role === "salesperson")))
      .catch((err) => toast.error(err));
  }, [toast]);

  const [teamPipe, setTeamPipe] = useState(null);

  useEffect(() => {
    Promise.all([
      getTrends({ salesperson: salespersonId || undefined }),
      getLeaderboard({ period: "month" }),
    ])
      .then(([trends, board]) => setWide({ trends, board }))
      .catch((err) => toast.error(err));
  }, [salespersonId, toast]);

  useEffect(() => {
    getTeamPipeline()
      .then(setTeamPipe)
      .catch(() => {});
  }, []);

  const loadCore = useCallback(() => {
    setCore(null);
    const params = { ...period, salesperson: salespersonId || undefined };
    Promise.all([getSummary(params), getFunnel(params)])
      .then(([summary, funnel]) => setCore({ summary, funnel }))
      .catch((err) => toast.error(err));
  }, [period, salespersonId, toast]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  // The "Top" board is a company/team-wide ranking; slicing to one person
  // just narrows it to their own row instead of refetching a ranking of one.
  const boardRows = (rows) => (salespersonId ? rows.filter((r) => r.salespersonId === salespersonId) : rows);

  const isYear = period.month === "year";
  const isAllTime = period.month === "all";
  const periodLabel = isAllTime ? "all time" : isYear ? `${period.year}` : `${MONTHS[period.month - 1]} ${period.year}`;
  const periodNoun = isAllTime ? "All time" : isYear ? "Full year" : "This month";
  const leadsStatLabel = isAllTime
    ? "Leads · all time"
    : isYear
    ? `Leads · ${period.year}`
    : `Leads · ${MONTHS[period.month - 1]}`;
  const weekLabel = (d) => {
    const dt = new Date(d);
    return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
  };
  const statusItems = (rows) =>
    LEAD_STATUS_ORDER.map((s) => ({
      status: s,
      label: LEAD_STATUS[s].label,
      value: rows?.find((r) => r.status === s)?.count || 0,
      color: LEAD_STATUS[s].fill,
    }));

  // Drill-down link builders — the selected period as a date range (all time →
  // an open-ended range so the Leads list matches), plus the salesperson slicer.
  const pad = (n) => String(n).padStart(2, "0");
  const rangeQ = isAllTime
    ? `from=2000-01-01&to=${new Date().toISOString().slice(0, 10)}`
    : isYear
    ? `from=${period.year}-01-01&to=${period.year}-12-31`
    : `from=${period.year}-${pad(period.month)}-01&to=${period.year}-${pad(period.month)}-${pad(
        new Date(period.year, period.month, 0).getDate()
      )}`;
  const spQ = salespersonId ? `&assignedTo=${salespersonId}` : "";
  const leadsInMonth = (extra = "") => `/leads?${rangeQ}${spQ}${extra}`;
  const ifoInMonth = `/ifo?${rangeQ}`;
  const fromDash = { from: "dashboard" }; // Link/nav state → the list shows a Back button
  const openStage = (status) => nav(leadsInMonth(`&status=${status}`), { state: fromDash });

  const nothingYet =
    core && core.summary.monthLeads === 0 && core.summary.totalConversions === 0 && core.summary.pipelineValue === 0;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <SalespersonPicker value={salespersonId} onChange={setSalespersonId} people={people} />
            <MonthPicker value={period} onChange={setPeriod} allowYear allowAllTime />
          </div>
        }
      />

      {!core ? (
        <Spinner />
      ) : nothingYet ? (
        <Card padding="p-10">
          <EmptyState
            icon={MdOutlineInsights}
            title="Nothing to analyse yet"
            message="As your team adds leads, logs calls and records conversions, this dashboard fills in — KPIs and the lead-status breakdown, filterable by month and by salesperson."
            action={
              <Button as={Link} to="/leads">
                Go to Leads
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <SectionLabel hint={`Showing ${periodLabel}`}>{periodNoun}</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatCard label={leadsStatLabel} value={core.summary.monthLeads} icon={MdOutlineAssignment} to={leadsInMonth()} state={fromDash} />
            <StatCard label="First meetings" value={core.summary.meetings} icon={MdOutlineGroups} hint="unique leads met" to="/calls" state={fromDash} />
            <StatCard
              label="Clients won"
              value={core.summary.clients}
              icon={MdOutlineHandshake}
              accent="text-emerald-600"
              hint={core.summary.clientsUnpaid ? `${core.summary.clientsUnpaid} not paid yet` : "deals signed"}
              to={ifoInMonth}
              state={fromDash}
            />
            <StatCard label="Conversion ratio" value={`${core.summary.conversionRatio}%`} icon={MdTrendingUp} hint="meetings → clients" />
            <StatCard
              label="Revenue"
              value={inrCompact(core.summary.revenue)}
              icon={MdOutlineMonetizationOn}
              accent="text-emerald-600"
              hint={`${inrCompact(core.summary.collected || 0)} collected`}
              to={ifoInMonth}
              state={fromDash}
            />
          </div>

          <div className="grid xl:grid-cols-2 gap-4 mt-4">
            <Card>
              <h3 className="font-bold text-gray-800">Lead status</h3>
              <p className="text-xs font-semibold text-gray-500 mb-3">
                {isAllTime ? "Where every lead stands" : `Where ${periodLabel}'s new leads stand`} right now — click a
                stage.
              </p>
              <DonutChart data={statusItems(core.summary.statusSplit)} centerLabel="new leads" onItemClick={(d) => openStage(d.status)} />
            </Card>
            <Card>
              <h3 className="font-bold text-gray-800">Pipeline funnel</h3>
              <p className="text-xs font-semibold text-gray-500 mb-3">The same leads, as a bar per stage — click to open them.</p>
              <BarList items={statusItems(core.funnel)} onItemClick={(it) => openStage(it.status)} />
            </Card>
          </div>

          <SectionLabel>All-time</SectionLabel>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Open pipeline value" value={inrCompact(core.summary.pipelineValue)} icon={MdOutlineFilterAlt} hint="active leads" to={`/leads?open=1${spQ}`} state={fromDash} />
            <StatCard label="Follow-ups due" value={core.summary.openFollowUps} hint="overdue + today" to={`/leads?followup=due${spQ}`} state={fromDash} />
            <StatCard
              label="Total revenue"
              value={inrCompact(core.summary.totalRevenue)}
              icon={MdOutlineMonetizationOn}
              accent="text-emerald-600"
              hint={`${inrCompact(core.summary.totalCollected || 0)} collected`}
              to="/ifo"
              state={fromDash}
            />
            <StatCard
              label="Total clients"
              value={core.summary.totalConversions}
              icon={MdOutlineHandshake}
              hint={core.summary.totalUnpaid ? `${core.summary.totalUnpaid} owe money` : "all paid up"}
              to="/ifo"
              state={fromDash}
            />
          </div>

          {teamPipe && teamPipe.rows.length > 0 && (
            <>
              <SectionLabel>Pipeline by salesperson</SectionLabel>
              <Card padding="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                        <th className="py-2.5 px-4 font-bold sticky left-0 bg-white">Salesperson</th>
                        {LEAD_STATUS_ORDER.map((s) => (
                          <th key={s} className="py-2.5 px-2 font-bold text-center whitespace-nowrap">
                            {LEAD_STATUS[s].label}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 font-bold text-right">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {teamPipe.rows.map((r) => (
                        <tr key={r.salespersonId} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-4 font-bold text-gray-800 whitespace-nowrap sticky left-0 bg-white">
                            {r.name}
                          </td>
                          {LEAD_STATUS_ORDER.map((s) => {
                            const c = r.byStatus[s] || 0;
                            return (
                              <td key={s} className="py-2.5 px-2 text-center">
                                {c > 0 ? (
                                  <Link
                                    to={`/leads?status=${s}&assignedTo=${r.salespersonId}`}
                                    state={fromDash}
                                    className="inline-flex min-w-[24px] justify-center rounded-md px-1.5 py-0.5 font-bold text-gray-800 hover:bg-primary-light/60"
                                  >
                                    {c}
                                  </Link>
                                ) : (
                                  <span className="text-gray-300">·</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-bold text-gray-700">{r.open}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {wide && !nothingYet && (
        <>
          <SectionLabel>Trends</SectionLabel>
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <h3 className="font-bold text-gray-800 mb-3">Leads added — last 8 weeks</h3>
              <TrendLine data={wide.trends.leadsWeekly.map((w) => ({ x: weekLabel(w.week), y: w.count }))} yLabel="Leads" />
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <MdEmojiEvents className="text-amber-500" size={18} /> Top — last 30 days
                </h3>
                <Link to="/leaderboard" className="text-xs font-semibold text-primary hover:underline">
                  Full board
                </Link>
              </div>
              <BarList
                items={boardRows(wide.board.rows)
                  .slice(0, 5)
                  .map((r) => ({ label: r.name, value: r.score }))}
                valueFormat={(n) => `${n} pts`}
              />
            </Card>
            <Card className="xl:col-span-3">
              <h3 className="font-bold text-gray-800 mb-3">Revenue — last 5 months</h3>
              <MiniBars
                data={wide.trends.conversionsMonthly.map((m) => ({ x: MONTHS[new Date(m.month).getMonth()], y: m.revenue }))}
                format={inrCompact}
                label="Revenue"
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
