import { useCallback, useState } from "react";
import { MdFileDownload, MdPictureAsPdf, MdRefresh } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import MonthPicker from "../../components/MonthPicker.jsx";
import CallingReportTable from "../../components/CallingReportTable.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import { MONTHS, fmtDate, fromNow } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getCallingReport } from "../../services/reportService.js";

// Flat rows for CSV / PDF — one line per (week, salesperson) + a week TOTAL,
// then the Month Total block. One column per Zoom meeting — this report is
// Zoom-only, event/conversion numbers live in other reports.
const flatten = (data) => {
  if (!data) return { columns: [], rows: [] };
  const dyn = data.meetings.map((m) => ({ h: `${m.title} (${fmtDate(m.scheduledAt)})`, bag: "zooms", key: m.webinarId }));
  const headers = ["Section", "Name", "Leads", "Called", ...dyn.map((c) => c.h)];
  const line = (section, name, src) => {
    const r = { Section: section, Name: name, Leads: src.leads ?? 0, Called: src.called ?? 0 };
    dyn.forEach((c) => (r[c.h] = src[c.bag]?.[c.key] ?? 0));
    return r;
  };
  const rows = [];
  for (const wk of [...data.weeks, data.monthTotal]) {
    wk.rows.forEach((r) => rows.push(line(wk.label, r.name, r)));
    rows.push(line(wk.label, "TOTAL", wk.total));
  }
  return { columns: headers.map((k) => ({ key: k, header: k })), rows };
};

export default function CallingReport() {
  const toast = useToast();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  // Live: same refresh model as the Sales Report — auto-updates every 20s and
  // on tab focus, no reload.
  const fetchReport = useCallback(() => getCallingReport(period), [period]);
  const { data, loading, error, refreshedAt, reload } = useLiveData(fetchReport, [
    period.month,
    period.year,
  ]);

  const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`;
  const fileBase = `RBH-calling-report-${period.year}-${String(period.month).padStart(2, "0")}`;

  const doCSV = () => {
    const { columns, rows } = flatten(data);
    exportCSV(`${fileBase}.csv`, columns, rows);
    toast.success("CSV downloaded.");
  };
  const doPDF = () => {
    const { columns, rows } = flatten(data);
    exportPDF({
      filename: `${fileBase}.pdf`,
      title: "RBH Sales CRM — Calling Sales Report",
      subtitle: `${periodLabel} · leads & Zoom attendance per salesperson`,
      columns,
      rows,
    });
    toast.success("PDF downloaded.");
  };

  return (
    <div>
      <PageHeader
        title="Calling Sales Report"
        subtitle="Week by week — leads, calling coverage, and Zoom attendance per salesperson."
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
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <p className="text-sm text-gray-500">
                Showing <b className="text-gray-700">{periodLabel}</b> — click a week to see each
                salesperson.
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
            <CallingReportTable data={data} />
          </>
        )}
      </Card>
    </div>
  );
}
