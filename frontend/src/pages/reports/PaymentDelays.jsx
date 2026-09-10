import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdFileDownload, MdPictureAsPdf, MdOpenInNew, MdWarningAmber } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import SectionLabel from "../../components/SectionLabel.jsx";
import SalespersonPicker from "../../components/SalespersonPicker.jsx";
import BarList from "../../components/charts/BarList.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import { inr, inrCompact, fmtDate, fromNow } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getPaymentDelays } from "../../services/reportService.js";
import { getAssignable } from "../../services/userService.js";

const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

export default function PaymentDelays() {
  const toast = useToast();
  const nav = useNavigate();
  const [salespersonId, setSalespersonId] = useState("");
  const [people, setPeople] = useState([]);

  useEffect(() => {
    getAssignable()
      .then((rows) => setPeople(rows.filter((u) => u.role === "salesperson")))
      .catch(() => {});
  }, []);

  const fetch = useCallback(
    () => getPaymentDelays({ salesperson: salespersonId || undefined }),
    [salespersonId]
  );
  const { data, loading, error, refreshedAt, reload } = useLiveData(fetch, [salespersonId]);
  const s = data?.summary || {};

  const exportCols = ["Outlet", "Client", "Owner", "Amount", "Due", "Settled", "Days delayed", "Status"].map(
    (k) => ({ key: k, header: k })
  );
  const exportRows = () =>
    (data?.items || []).map((r) => ({
      Outlet: r.outlet,
      Client: r.client,
      Owner: r.owner,
      Amount: r.amount,
      Due: fmtDate(r.dueDate),
      Settled: r.settledDate ? fmtDate(r.settledDate) : "not paid",
      "Days delayed": r.delayDays,
      Status: r.status === "paid_late" ? "Paid late" : "Overdue (unpaid)",
    }));
  const doCSV = () => {
    exportCSV("RBH-payment-delays.csv", exportCols, exportRows());
    toast.success("CSV downloaded.");
  };
  const doPDF = () => {
    exportPDF({
      filename: "RBH-payment-delays.pdf",
      title: "RBH Sales CRM — Payment Delays",
      subtitle: `${s.total || 0} delayed · avg ${s.avgDelayDays || 0} days`,
      columns: exportCols,
      rows: exportRows(),
    });
    toast.success("PDF downloaded.");
  };

  return (
    <div>
      <PageHeader
        title="Payment Delays"
        subtitle="Instalments that came in late, or are overdue and still unpaid — and who they sit with."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <SalespersonPicker value={salespersonId} onChange={setSalespersonId} people={people} />
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
      ) : data.items.length === 0 ? (
        <Card padding="p-10">
          <EmptyState
            icon={MdWarningAmber}
            title="No payment delays"
            message="Every instalment so far has come in on time. Late or overdue ones will show up here."
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
            <StatCard label="Delayed payments" value={s.total} hint={`${s.paidLateCount} paid late · ${s.pendingCount} still unpaid`} />
            <StatCard label="Avg delay" value={days(s.avgDelayDays)} accent="text-amber-600" />
            <StatCard label="Worst delay" value={days(s.maxDelayDays)} accent="text-red-500" icon={MdWarningAmber} />
            <StatCard label="Amount affected" value={inrCompact(s.delayedAmount)} />
          </div>

          <SectionLabel>By salesperson</SectionLabel>
          <Card>
            <p className="text-xs text-gray-400 mb-3">Average days delayed per person (paid-late + overdue).</p>
            <BarList
              items={data.bySalesperson.map((o) => ({
                label: o.name,
                value: o.avgDelayDays,
                color: o.avgDelayDays >= 15 ? "#DC2626" : o.avgDelayDays >= 7 ? "#D97706" : "#9CA3AF",
              }))}
              valueFormat={(n) => `${n}d`}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-3 font-medium">Salesperson</th>
                    <th className="py-2 px-3 font-medium text-right">Delayed</th>
                    <th className="py-2 px-3 font-medium text-right">Paid late</th>
                    <th className="py-2 px-3 font-medium text-right">Unpaid</th>
                    <th className="py-2 px-3 font-medium text-right">Avg</th>
                    <th className="py-2 px-3 font-medium text-right">Worst</th>
                    <th className="py-2 px-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.bySalesperson.map((o) => (
                    <tr key={o.name}>
                      <td className="py-2.5 px-3 text-gray-700">{o.name}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-800">{o.count}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{o.paidLate}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{o.pending}</td>
                      <td className={`py-2.5 px-3 text-right ${o.avgDelayDays >= 15 ? "text-red-500 font-medium" : "text-gray-600"}`}>
                        {o.avgDelayDays}d
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{o.maxDelayDays}d</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{inrCompact(o.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <SectionLabel>Every delayed payment</SectionLabel>
          <Card padding="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="py-2.5 px-4 font-medium">Outlet / client</th>
                    <th className="py-2.5 px-4 font-medium">Owner</th>
                    <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                    <th className="py-2.5 px-4 font-medium text-right">Due</th>
                    <th className="py-2.5 px-4 font-medium text-right">Delay</th>
                    <th className="py-2.5 px-4 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.items.map((r, i) => (
                    <tr key={`${r.conversionId}-${i}`} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-800">{r.outlet}</span>
                        <p className="text-xs text-gray-400">{r.client}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{r.owner}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{inr(r.amount)}</td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        {fmtDate(r.dueDate)}
                        <p className="text-[11px] text-gray-400">
                          {r.status === "paid_late" ? `paid ${fmtDate(r.settledDate)}` : "not paid yet"}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge color={r.status === "paid_late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
                          {r.delayDays}d {r.status === "paid_late" ? "late" : "overdue"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => r.leadId && nav(`/leads/${r.leadId}`)}
                          disabled={!r.leadId}
                          className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                          title="Open lead"
                        >
                          <MdOpenInNew size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
