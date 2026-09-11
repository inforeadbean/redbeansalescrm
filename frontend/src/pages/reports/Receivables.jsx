import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdFileDownload,
  MdPictureAsPdf,
  MdNotificationsActive,
  MdPayments,
  MdOpenInNew,
  MdWarningAmber,
} from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import SectionLabel from "../../components/SectionLabel.jsx";
import SalespersonPicker from "../../components/SalespersonPicker.jsx";
import BarList from "../../components/charts/BarList.jsx";
import ReminderModal from "../leads/ReminderModal.jsx";
import ConversionInfoModal from "../ifo/ConversionInfoModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLiveData } from "../../hooks/useLiveData.js";
import useConversionTypes from "../../hooks/useConversionTypes.js";
import { inr, inrCompact, fmtDate, fromNow } from "../../utils/format.js";
import { exportCSV, exportPDF } from "../../utils/exporters.js";
import { getReceivables } from "../../services/reportService.js";
import { getAssignable } from "../../services/userService.js";

const days = (n) => (n == null ? "—" : n < 1 ? "today" : `${n} day${n === 1 ? "" : "s"}`);

export default function Receivables() {
  const toast = useToast();
  const nav = useNavigate();
  const { byCode: typesByCode, options: typeOptions } = useConversionTypes();
  const [type, setType] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [people, setPeople] = useState([]);
  const [remindFor, setRemindFor] = useState(null); // { lead, note }
  const [payFor, setPayFor] = useState(null); // conversion id

  useEffect(() => {
    getAssignable()
      .then((rows) => setPeople(rows.filter((u) => u.role === "salesperson")))
      .catch(() => {});
  }, []);

  const fetch = useCallback(
    () => getReceivables({ type: type || undefined, salesperson: salespersonId || undefined }),
    [type, salespersonId]
  );
  const { data, loading, error, refreshedAt, reload } = useLiveData(fetch, [type, salespersonId]);

  const s = data?.summary || {};

  const exportCols = [
    "Outlet", "Client", "Owner", "Type", "Deal", "Received", "Outstanding", "Converted", "Idle days",
  ].map((k) => ({ key: k, header: k }));
  const exportRows = () =>
    (data?.rows || []).map((r) => ({
      Outlet: r.outletName,
      Client: r.lead?.name || "—",
      Owner: r.owner,
      Type: typesByCode[r.conversionType]?.label || r.conversionType,
      Deal: r.dealValue,
      Received: r.amountReceived,
      Outstanding: r.outstanding,
      Converted: fmtDate(r.conversionDate),
      "Idle days": r.idleDays,
    }));
  const doCSV = () => {
    exportCSV("RBH-receivables.csv", exportCols, exportRows());
    toast.success("CSV downloaded.");
  };
  const doPDF = () => {
    exportPDF({
      filename: "RBH-receivables.pdf",
      title: "RBH Sales CRM — Receivables",
      subtitle: `Outstanding ${inr(s.totalOutstanding || 0)} across ${s.count || 0} deals`,
      columns: exportCols,
      rows: exportRows(),
    });
    toast.success("PDF downloaded.");
  };

  return (
    <div>
      <PageHeader
        title="Receivables"
        subtitle="Conversions that still owe money — who, how much, and how long it's been pending."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <SalespersonPicker value={salespersonId} onChange={setSalespersonId} people={people} />
            <Listbox
              className="w-32"
              value={type}
              onChange={setType}
              options={[{ value: "", label: "All types" }, ...typeOptions]}
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
      ) : data.rows.length === 0 ? (
        <Card padding="p-10">
          <EmptyState
            icon={MdPayments}
            title="Nothing outstanding"
            message="Every conversion in scope is fully paid. New partial payments will show up here."
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
            <StatCard label="Outstanding" value={inrCompact(s.totalOutstanding)} accent="text-amber-600" hint={`${s.count} deals pending`} />
            <StatCard label="Collected so far" value={inrCompact(s.totalCollected)} accent="text-emerald-600" hint={`of ${inrCompact(s.totalDeal)} signed`} />
            <StatCard
              label={`Overdue (>${s.overdueDays}d)`}
              value={inrCompact(s.overdueAmount)}
              accent="text-red-500"
              icon={MdWarningAmber}
              hint={`${s.overdueCount} deal${s.overdueCount === 1 ? "" : "s"}`}
            />
            <StatCard label="Longest pending" value={days(s.oldestDays)} />
          </div>

          <div className="grid xl:grid-cols-3 gap-4 mt-2">
            <Card className="xl:col-span-1">
              <h3 className="font-semibold text-gray-800 mb-1">Aging</h3>
              <p className="text-xs text-gray-400 mb-3">By time since last payment.</p>
              <BarList
                items={data.aging.map((a) => ({ label: a.bucket, value: a.amount }))}
                valueFormat={(n) => inrCompact(n)}
              />
            </Card>

            <Card className="xl:col-span-2" padding="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                      <th className="py-2.5 px-4 font-medium">Outlet / client</th>
                      <th className="py-2.5 px-4 font-medium">Owner</th>
                      <th className="py-2.5 px-4 font-medium text-right">Outstanding</th>
                      <th className="py-2.5 px-4 font-medium text-right">Pending</th>
                      <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.rows.map((r) => {
                      const pctPaid = r.dealValue ? Math.round((r.amountReceived / r.dealValue) * 100) : 0;
                      return (
                        <tr key={r._id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{r.outletName}</span>
                              <Badge color={typesByCode[r.conversionType]?.color}>
                                {typesByCode[r.conversionType]?.label || r.conversionType}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400">{r.lead?.name || "—"}</p>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{r.owner}</td>
                          <td className="py-3 px-4 text-right">
                            <p className="font-semibold text-amber-700">{inr(r.outstanding)}</p>
                            <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden w-24 ml-auto">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pctPaid}%` }} />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">{inrCompact(r.amountReceived)} / {inrCompact(r.dealValue)}</p>
                          </td>
                          <td className={`py-3 px-4 text-right ${r.overdue ? "text-red-500 font-medium" : "text-gray-600"}`}>
                            {days(r.idleDays)}
                            <p className="text-[11px] text-gray-400 font-normal">
                              {r.lastPaymentAt ? `last paid ${fromNow(r.lastPaymentAt)}` : "nothing yet"}
                            </p>
                            {r.nextInstallmentDate && (
                              <p className={`text-[11px] font-normal ${r.nextInstallmentOverdue ? "text-red-500" : "text-blue-500"}`}>
                                next {r.nextInstallmentOverdue ? "was due" : "due"} {fmtDate(r.nextInstallmentDate)}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setRemindFor({
                                    lead: r.lead,
                                    note: `Payment follow-up — ${inr(r.outstanding)} of ${inr(r.dealValue)} still due for ${r.outletName}`,
                                  })
                                }
                                disabled={!r.lead}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-primary-dark disabled:opacity-40"
                                title="Set a payment reminder for the owner"
                              >
                                <MdNotificationsActive size={16} />
                              </button>
                              <button
                                onClick={() => setPayFor(r._id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-emerald-600"
                                title="Record a payment"
                              >
                                <MdPayments size={16} />
                              </button>
                              <button
                                onClick={() => r.lead && nav(`/leads/${r.lead._id}`)}
                                disabled={!r.lead}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                                title="Open lead"
                              >
                                <MdOpenInNew size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      <ReminderModal
        open={!!remindFor}
        onClose={() => setRemindFor(null)}
        onSaved={() => toast.success("Reminder set for the lead owner.")}
        lead={remindFor?.lead}
        defaultNote={remindFor?.note || ""}
      />
      <ConversionInfoModal
        open={!!payFor}
        conversionId={payFor}
        onClose={() => setPayFor(null)}
        onChanged={reload}
      />
    </div>
  );
}
