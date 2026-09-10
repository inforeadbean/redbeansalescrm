import { useCallback, useState } from "react";
import { MdFileDownload, MdPictureAsPdf, MdRefresh } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import MonthPicker from "../../components/MonthPicker.jsx";
import FiveForThreeTable from "../../components/FiveForThreeTable.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import { MONTHS, inr, fromNow } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getFiveForThree } from "../../services/reportService.js";

const COLS = [
  { key: "leads", label: "Leads" },
  { key: "webinar", label: "Zoom Cand." },
  { key: "event", label: "Event Cand." },
  { key: "clients", label: "Clients" },
  { key: "conversionRatio", label: "Conv %", pctf: true },
  { key: "avgSale", label: "Avg Sale", money: true },
  { key: "revenue", label: "Revenue", money: true },
];

// One flat row per (section, person/total) with Pl+Act for every metric.
function flatten(data) {
  const rows = [];
  const push = (section, name, src) => {
    const r = { Section: section, Name: name };
    for (const c of COLS) {
      const cell = src[c.key] || { pl: 0, act: 0 };
      const f = (n) => (n == null ? "—" : c.money ? inr(n) : c.pctf ? `${n}%` : n);
      r[`${c.label} Pl`] = f(cell.pl);
      r[`${c.label} Act`] = f(cell.act);
    }
    rows.push(r);
  };
  for (const wk of data.weeks) {
    wk.rows.forEach((p) => push(wk.label, p.name, p));
    push(wk.label, "TOTAL", wk.total);
  }
  data.monthTotal.rows.forEach((p) => push("Month Total", p.name, p));
  push("Month Total", "TOTAL", data.monthTotal.total);
  return rows;
}

export default function PerformanceReport() {
  const toast = useToast();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  // Live: fetched on load + on month change, then auto-refreshed every 20s and
  // whenever the tab regains focus — the sales head watches it update as the
  // team enters data, no page reload.
  const fetchReport = useCallback(() => getFiveForThree(period), [period]);
  const { data, loading, error, refreshedAt, reload } = useLiveData(fetchReport, [period.month, period.year]);

  const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`;
  const fileBase = `RBH-5for3-${period.year}-${String(period.month).padStart(2, "0")}`;

  const columns = ["Section", "Name", ...COLS.flatMap((c) => [`${c.label} Pl`, `${c.label} Act`])].map((k) => ({
    key: k,
    header: k,
  }));

  const doCSV = () => {
    exportCSV(`${fileBase}.csv`, columns, flatten(data));
    toast.success("CSV downloaded.");
  };
  const doPDF = () => {
    exportPDF({
      filename: `${fileBase}.pdf`,
      title: "RBH Sales CRM — 5 for 3 (Sales Person Wise)",
      subtitle: `${periodLabel} · planned vs actual, week by week`,
      columns,
      rows: flatten(data),
    });
    toast.success("PDF downloaded.");
  };

  const empty =
    data && data.weeks.every((w) => w.rows.every((r) => r.leads.act === 0 && r.leads.pl === 0));

  return (
    <div>
      <PageHeader
        title="5 for 3 — Sales Person Wise"
        subtitle="The one sales report: planned vs actual per salesperson, week by week."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <MonthPicker value={period} onChange={setPeriod} />
            <Button variant="secondary" onClick={doCSV} disabled={!data}>
              <MdFileDownload size={16} /> CSV
            </Button>
            <Button variant="secondary" onClick={doPDF} disabled={!data}>
              <MdPictureAsPdf size={16} /> PDF
            </Button>
          </div>
        }
      />

      <Card padding="p-5">
        {loading || !data ? (
          <Spinner />
        ) : empty ? (
          <EmptyState
            title={`No data for ${periodLabel}`}
            message="This fills in as the team moves leads through the pipeline and records conversions — it updates here automatically."
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <p className="text-sm text-gray-500">
                Showing <b className="text-gray-700">{periodLabel}</b> — click a week to see each salesperson.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {error ? (
                  <span className="text-amber-600">Couldn't refresh — retrying…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live · updated {fromNow(refreshedAt)}
                  </span>
                )}
                <button
                  onClick={reload}
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-primary"
                  title="Refresh now"
                >
                  <MdRefresh size={15} />
                </button>
              </div>
            </div>
            <FiveForThreeTable data={data} />
          </>
        )}
      </Card>
    </div>
  );
}
