import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { MdAdd, MdMonetizationOn, MdStorefront, MdEdit, MdSavings, MdInfoOutline, MdClose, MdArrowBack } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import DataTable from "../../components/DataTable.jsx";
import Listbox from "../../components/ui/Listbox.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import IfoFormModal from "./IfoFormModal.jsx";
import ConversionInfoModal from "./ConversionInfoModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import PeriodFilter, { periodRange } from "../../components/PeriodFilter.jsx";
import useConversionTypes from "../../hooks/useConversionTypes.js";
import { inr, inrCompact, fmtDate, pct } from "../../utils/format.js";
import { listIfo } from "../../services/ifoService.js";

export default function IfoList() {
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const { byCode: typesByCode, options: typeOptions } = useConversionTypes();
  const [searchParams, setSearchParams] = useSearchParams();
  const [fromDash] = useState(() => location.state?.from === "dashboard");
  const [page, setPage] = useState(1);
  const [type, setType] = useState(searchParams.get("type") || "");
  // Date range: a dashboard drill-down link sets ?from/?to on the URL; otherwise
  // the period slicer applies (default this month). "All time" tiles from the
  // dashboard arrive with state.from === "dashboard" and no dates → show all.
  const urlFrom = searchParams.get("from") || "";
  const urlTo = searchParams.get("to") || "";
  const [period, setPeriod] = useState(() =>
    urlFrom || urlTo || fromDash ? "all" : localStorage.getItem("rbh_ifo_period") || "month"
  );
  const pr = periodRange(period);
  const rangeFrom = urlFrom || (period === "all" ? "" : pr.from || "");
  const rangeTo = urlTo || (period === "all" ? "" : pr.to || "");
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState({ data: [], total: 0, page: 1, pages: 1, summary: {} });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [infoId, setInfoId] = useState(null);

  useEffect(() => localStorage.setItem("rbh_ifo_period", period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRes(
        await listIfo({
          page,
          limit: 20,
          type: type || undefined,
          from: rangeFrom || undefined,
          to: rangeTo || undefined,
        })
      );
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, type, rangeFrom, rangeTo, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const s = res.summary;

  const columns = [
    {
      key: "outletName",
      header: "Outlet",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-800">{r.outletName}</p>
          <p className="text-xs text-gray-400">{r.lead?.name}</p>
        </div>
      ),
    },
    {
      key: "conversionType",
      header: "Type",
      render: (r) => <Badge color={typesByCode[r.conversionType]?.color}>{typesByCode[r.conversionType]?.label || r.conversionType}</Badge>,
    },
    { key: "outletCity", header: "City", render: (r) => r.outletCity || "—" },
    { key: "convertedBy", header: "Closed by", render: (r) => r.convertedBy?.name || "—" },
    { key: "conversionDate", header: "Date", render: (r) => fmtDate(r.conversionDate) },
    {
      key: "payment",
      header: "Received / Deal",
      align: "right",
      render: (r) => {
        const p = pct(r.amountReceived, r.dealValue);
        const paid = p >= 100;
        const nil = (r.amountReceived || 0) === 0;
        return (
          <div className="min-w-[130px]">
            <p className="text-gray-800">
              <b className={nil ? "text-red-500" : ""}>{inrCompact(r.amountReceived)}</b>
              <span className="text-gray-400"> / {inrCompact(r.dealValue)}</span>
            </p>
            <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full ${paid ? "bg-green-500" : nil ? "bg-red-400" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, Math.max(p, 2))}%` }}
              />
            </div>
            <p className={`text-[11px] mt-0.5 ${paid ? "text-green-600" : nil ? "text-red-500 font-medium" : "text-amber-600"}`}>
              {paid ? "fully paid" : nil ? "unpaid" : `${p}% paid`}
            </p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInfoId(r._id);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-primary-dark"
            title="Payment history & record a payment"
          >
            <MdInfoOutline size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(r);
              setFormOpen(true);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Edit conversion details"
          >
            <MdEdit size={15} />
          </button>
        </div>
      ),
    },
  ];

  const goBack = () => (window.history.state?.idx > 0 ? nav(-1) : nav("/dashboard"));

  return (
    <div>
      {(fromDash || rangeFrom || rangeTo) && (
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <MdArrowBack size={16} /> Back
        </button>
      )}

      <PageHeader
        title="Conversions"
        subtitle="IFO (₹2L) and RBC (₹5L) wins — update instalment payments as they come in."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <MdAdd size={18} /> Record conversion
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="Conversions"
          value={s.count || 0}
          icon={MdStorefront}
          hint={(s.byType || []).map((t) => `${t.count} ${t.name}`).join(" · ")}
        />
        <StatCard label="Deal value" value={inrCompact(s.revenue || 0)} icon={MdMonetizationOn} />
        <StatCard label="Collected" value={inrCompact(s.collected || 0)} icon={MdSavings} accent="text-green-600" />
        <StatCard
          label="Outstanding"
          value={inrCompact(s.outstanding || 0)}
          accent="text-amber-600"
          hint={s.revenue ? `${pct(s.collected, s.revenue)}% collected` : ""}
        />
      </div>

      <Card padding="p-2">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <Listbox
            className="w-32"
            value={type}
            onChange={(v) => {
              setType(v);
              setPage(1);
              const next = new URLSearchParams(searchParams);
              v ? next.set("type", v) : next.delete("type");
              setSearchParams(next, { replace: true });
            }}
            options={[{ value: "", label: "All types" }, ...typeOptions]}
          />
          {!urlFrom && !urlTo && (
            <PeriodFilter value={period} onChange={(k) => { setPeriod(k); setPage(1); }} />
          )}
          {(urlFrom || urlTo) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light/70 text-primary-dark px-3 py-1 text-sm font-medium">
              {urlFrom ? fmtDate(urlFrom) : "…"}–{urlTo ? fmtDate(urlTo) : "…"}
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("from");
                  next.delete("to");
                  setSearchParams(next, { replace: true });
                  setPage(1);
                }}
                className="text-primary-dark/60 hover:text-primary-dark"
                title="Clear date filter"
              >
                <MdClose size={14} />
              </button>
            </span>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={res.data}
          loading={loading}
          onRowClick={(r) => r.lead && nav(`/leads/${r.lead._id}`)}
          empty={<EmptyState icon={MdStorefront} title="No conversions yet" message="Record your first IFO or RBC win." />}
        />
        <div className="px-2">
          <Pagination page={res.page} pages={res.pages} total={res.total} onChange={setPage} />
        </div>
      </Card>

      <IfoFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} ifo={editing} />
      <ConversionInfoModal
        open={!!infoId}
        conversionId={infoId}
        onClose={() => setInfoId(null)}
        onChanged={load}
      />
    </div>
  );
}
