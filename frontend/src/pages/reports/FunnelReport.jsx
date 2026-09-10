import { useCallback, useEffect, useState } from "react";
import { MdFileDownload, MdPictureAsPdf, MdTrendingDown, MdSpeed } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import SectionLabel from "../../components/SectionLabel.jsx";
import SalespersonPicker from "../../components/SalespersonPicker.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import BarList from "../../components/charts/BarList.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import { LEAD_STATUS } from "../../utils/constants.js";
import { fromNow } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getFunnelReport } from "../../services/reportService.js";
import { getAssignable } from "../../services/userService.js";

const RANGES = [
  { key: "1m", label: "This month", months: 1 },
  { key: "3m", label: "Last 3 months", months: 3 },
  { key: "6m", label: "Last 6 months", months: 6 },
  { key: "12m", label: "Last 12 months", months: 12 },
  { key: "all", label: "All time", months: 0 },
];

const fromFor = (key) => {
  const r = RANGES.find((x) => x.key === key);
  if (!r || !r.months) return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - r.months);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const days = (n) => (n == null ? "—" : n < 1 ? "<1 day" : `${n} day${n === 1 ? "" : "s"}`);

export default function FunnelReport() {
  const toast = useToast();
  const [rangeKey, setRangeKey] = useState(() => localStorage.getItem("rbh_funnel_range") || "1m");
  const [salespersonId, setSalespersonId] = useState("");
  const [people, setPeople] = useState([]);

  useEffect(() => {
    getAssignable()
      .then((rows) => setPeople(rows.filter((u) => u.role === "salesperson")))
      .catch(() => {});
  }, []);

  const fetch = useCallback(
    () => getFunnelReport({ from: fromFor(rangeKey), salesperson: salespersonId || undefined }),
    [rangeKey, salespersonId]
  );
  const { data, loading, error, refreshedAt, reload } = useLiveData(fetch, [rangeKey, salespersonId]);

  const rangeLabel = RANGES.find((r) => r.key === rangeKey)?.label;

  const exportRows = () =>
    (data?.stages || []).map((s) => ({
      Stage: s.label,
      Reached: s.reached,
      "Reached %": `${s.reachedPct}%`,
      "Step conv %": `${s.stepConversionPct}%`,
      "Dropped here": s.dropFromPrev.count,
      "Drop %": `${s.dropFromPrev.pct}%`,
      "Currently here": s.currentlyHere,
      "Avg days in stage": s.avgDaysInStage,
    }));
  const exportCols = [
    "Stage", "Reached", "Reached %", "Step conv %", "Dropped here", "Drop %", "Currently here", "Avg days in stage",
  ].map((k) => ({ key: k, header: k }));

  const fileBase = `RBH-funnel-${rangeKey}${salespersonId ? "-1person" : ""}`;
  const doCSV = () => {
    exportCSV(`${fileBase}.csv`, exportCols, exportRows());
    toast.success("CSV downloaded.");
  };
  const doPDF = () => {
    exportPDF({
      filename: `${fileBase}.pdf`,
      title: "RBH Sales CRM — Pipeline Funnel",
      subtitle: `${rangeLabel} · leads created in range, by furthest stage reached`,
      columns: exportCols,
      rows: exportRows(),
    });
    toast.success("PDF downloaded.");
  };

  const empty = data && data.totalLeads === 0;
  const biggestLeak =
    data && [...data.stages].slice(1).sort((a, b) => b.dropFromPrev.count - a.dropFromPrev.count)[0];

  return (
    <div>
      <PageHeader
        title="Pipeline Funnel"
        subtitle="Where leads flow, stall and drop off — and how long each step takes."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <SalespersonPicker value={salespersonId} onChange={setSalespersonId} people={people} />
            <Listbox
              className="w-40"
              value={rangeKey}
              onChange={(v) => {
                setRangeKey(v);
                localStorage.setItem("rbh_funnel_range", v);
              }}
              options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
            />
            <Button variant="secondary" onClick={doCSV} disabled={!data}>
              <MdFileDownload size={16} /> CSV
            </Button>
            <Button variant="secondary" onClick={doPDF} disabled={!data}>
              <MdPictureAsPdf size={16} /> PDF
            </Button>
          </div>
        }
      />

      {loading || !data ? (
        <Spinner />
      ) : empty ? (
        <Card padding="p-10">
          <EmptyState
            title={`No leads created in ${rangeLabel.toLowerCase()}`}
            message="Pick a wider range, or add leads — this report reads the whole pipeline journey once there's data."
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-end mb-3 -mt-1">
            <span className="text-xs text-gray-400">
              {error ? "Couldn't refresh — retrying…" : `Live · updated ${fromNow(refreshedAt)}`}
              {" · "}
              <button onClick={reload} className="hover:text-primary">refresh</button>
            </span>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-2">
            <StatCard label="Leads in range" value={data.totalLeads} />
            <StatCard
              label="Converted"
              value={`${data.outcomes.conversionPct}%`}
              accent="text-emerald-600"
              hint={`${data.outcomes.converted} won · ${data.outcomes.open} open`}
            />
            <StatCard
              label="Avg lead → convert"
              value={days(data.timeToConvert.avgDays)}
              icon={MdSpeed}
              hint={`median ${days(data.timeToConvert.medianDays)}`}
            />
            <StatCard
              label="Biggest drop-off"
              value={biggestLeak && biggestLeak.dropFromPrev.count ? `${biggestLeak.dropFromPrev.pct}%` : "—"}
              accent="text-red-500"
              icon={MdTrendingDown}
              hint={biggestLeak && biggestLeak.dropFromPrev.count ? `entering ${biggestLeak.label}` : "no material drop"}
            />
          </div>

          <SectionLabel>The funnel</SectionLabel>
          <Card>
            <p className="text-xs text-gray-400 mb-4">
              Of {data.totalLeads} leads, how many got at least this far. Skipped stages still count as passed.
            </p>
            <div className="space-y-1">
              {data.stages.map((s, i) => (
                <div key={s.status}>
                  {i > 0 && s.dropFromPrev.count > 0 && (
                    <div className="flex items-center gap-2 pl-1 py-1 text-[11px] text-red-500">
                      <MdTrendingDown size={13} />
                      {s.dropFromPrev.count} lead{s.dropFromPrev.count === 1 ? "" : "s"} dropped
                      <span className="text-gray-400">({s.dropFromPrev.pct}% of previous step)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm text-gray-600 truncate" title={s.label}>
                      {s.label}
                    </span>
                    <span className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                      <span
                        className="flex h-full items-center justify-end rounded-lg px-2 text-[11px] font-semibold text-white transition-[width] duration-500"
                        style={{
                          width: `${Math.max(6, s.reachedPct)}%`,
                          background: LEAD_STATUS[s.status]?.fill || "#9CA3AF",
                        }}
                      >
                        {s.reached}
                      </span>
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm">
                      <span className="text-gray-800 font-semibold">{s.reachedPct}%</span>
                      {s.stepConversionPct < 100 && s.status !== "new" && (
                        <span className="block text-[11px] text-gray-400">{s.stepConversionPct}% step</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid xl:grid-cols-2 gap-4 mt-4">
            <Card>
              <h3 className="font-semibold text-gray-800">Where leads die</h3>
              <p className="text-xs text-gray-400 mb-3">
                Dead / invalid leads, by the last stage they reached.
              </p>
              {data.diedAt.length ? (
                <BarList
                  items={data.diedAt.map((d) => ({
                    label: d.label,
                    value: d.count,
                    color: LEAD_STATUS[d.status]?.fill,
                  }))}
                />
              ) : (
                <p className="text-sm text-gray-400 py-4">No dead or invalid leads in this range.</p>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-800">Avg days in each stage</h3>
              <p className="text-xs text-gray-400 mb-3">
                How long a lead sits here before moving on.
              </p>
              {data.stages.some((s) => s.timedCount > 0) ? (
                <BarList
                  items={data.stages
                    .filter((s) => s.status !== "converted" && s.timedCount > 0)
                    .map((s) => ({ label: s.label, value: s.avgDaysInStage, color: LEAD_STATUS[s.status]?.fill }))}
                  valueFormat={(n) => `${n}d`}
                />
              ) : (
                <p className="text-sm text-gray-400 py-4">Not enough stage movement yet.</p>
              )}
            </Card>
          </div>

          <SectionLabel>Open leads sitting in the pipeline</SectionLabel>
          <Card padding="p-0">
            {data.openByStage.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                      <th className="py-2.5 px-4 font-medium">Stage</th>
                      <th className="py-2.5 px-4 font-medium text-right">Open</th>
                      <th className="py-2.5 px-4 font-medium text-right">Avg age</th>
                      <th className="py-2.5 px-4 font-medium text-right">Oldest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.openByStage.map((o) => (
                      <tr key={o.status}>
                        <td className="py-3 px-4 text-gray-700">{o.label}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-800">{o.count}</td>
                        <td className={`py-3 px-4 text-right ${o.avgAgeDays >= 14 ? "text-amber-600 font-medium" : "text-gray-600"}`}>
                          {days(o.avgAgeDays)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500">{days(o.oldestDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 p-6 text-center">No open leads in this range.</p>
            )}
          </Card>

          <SectionLabel>Lead → conversion time</SectionLabel>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Average" value={days(data.timeToConvert.avgDays)} hint={`${data.timeToConvert.count} conversions`} />
            <StatCard label="Median" value={days(data.timeToConvert.medianDays)} />
            <StatCard label="Fastest" value={days(data.timeToConvert.fastestDays)} accent="text-emerald-600" />
            <StatCard label="Slowest" value={days(data.timeToConvert.slowestDays)} accent="text-amber-600" />
          </div>
        </>
      )}
    </div>
  );
}
