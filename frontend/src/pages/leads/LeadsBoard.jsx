import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { MdAdd, MdViewKanban, MdTableRows, MdSearch, MdUploadFile, MdClose, MdArrowBack } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import DataTable from "../../components/DataTable.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import KanbanBoard from "../../components/kanban/KanbanBoard.jsx";
import LeadStageSelect from "../../components/LeadStageSelect.jsx";
import LeadFormModal from "./LeadFormModal.jsx";
import ImportLeadsModal from "./ImportLeadsModal.jsx";
import IfoFormModal from "../ifo/IfoFormModal.jsx";
import StatusChangeModal from "./StatusChangeModal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import PeriodFilter, { periodRange } from "../../components/PeriodFilter.jsx";
import { LEAD_STATUS, LEAD_SOURCE, optionsFrom, moveBlocked } from "../../utils/constants.js";
import { fmtDate, inrCompact, pct } from "../../utils/format.js";
import {
  listLeads,
  getKanban,
  getKanbanColumn,
  deleteLead,
  undoLeadStatus,
} from "../../services/leadService.js";

// `status/source/q` have UI controls; the rest are drill-down filters set only
// by a dashboard tile link (?from=…&status=… etc.) and shown as a banner.
const emptyFilters = { status: "", source: "", q: "", from: "", to: "", open: "", followup: "", assignedTo: "" };
const DRILL_KEYS = ["from", "to", "open", "followup", "assignedTo"];

// Cards pulled per fetch as a column auto-fills on scroll. Bigger than the
// backend's first-paint `perColumn` (60) so a huge stage cascades in with a
// handful of requests, not dozens.
const KANBAN_PAGE = 200;

export default function LeadsBoard() {
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => {
    const f = { ...emptyFilters };
    for (const k of Object.keys(emptyFilters)) {
      const v = searchParams.get(k);
      if (v) f[k] = v;
    }
    return f;
  });
  // Captured once at mount — the URL-sync effect below wipes location.state.
  const [cameFromDrilldown] = useState(
    () =>
      location.state?.from === "dashboard" ||
      [...DRILL_KEYS, "status"].some((k) => searchParams.get(k))
  );
  const [view, setView] = useState(
    cameFromDrilldown ? "table" : localStorage.getItem("rbh_leads_view") || "kanban"
  );
  // Working lists default to the current month so imported historical leads
  // don't bury this month's work. Ignored while a dashboard drill-down is active.
  const [period, setPeriod] = useState(() => localStorage.getItem("rbh_leads_period") || "month");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [kanban, setKanban] = useState({});
  const [loadingCols, setLoadingCols] = useState({});
  const colInFlight = useRef({}); // synchronous guard against a double-fire loading the same page twice
  const [table, setTable] = useState({ data: [], total: 0, page: 1, pages: 1 });
  const [convertLead, setConvertLead] = useState(null);
  const [statusChange, setStatusChange] = useState(null); // { lead, toStatus }

  // A dashboard drill-down brings its own scope (?from/?to/?open/?followup);
  // otherwise the month/period slicer applies.
  const scoped = !!(filters.from || filters.to || filters.open || filters.followup);

  const cleanParams = useCallback(() => {
    const p = {};
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    if (!p.from && !p.to && !p.open && !p.followup && period !== "all") {
      const r = periodRange(period);
      if (r.from) p.from = r.from;
      if (r.to) p.to = r.to;
    }
    return p;
  }, [filters, period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "kanban") {
        const { columns } = await getKanban(cleanParams());
        setKanban(columns);
      } else {
        setTable(await listLeads({ ...cleanParams(), page, limit: 20 }));
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  }, [view, page, cleanParams, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => localStorage.setItem("rbh_leads_view", view), [view]);
  useEffect(() => localStorage.setItem("rbh_leads_period", period), [period]);

  // Keep the URL in step with the active filters — shareable, back-button safe.
  // Only write when something actually changed, to avoid a setSearchParams loop.
  useEffect(() => {
    const next = {};
    for (const [k, v] of Object.entries(filters)) if (v) next[k] = v;
    const same =
      Object.keys(next).length === [...searchParams.keys()].length &&
      Object.entries(next).every(([k, v]) => searchParams.get(k) === v);
    if (!same) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const setFilter = (patch) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const clearDrill = () =>
    setFilters((f) => ({ ...f, from: "", to: "", open: "", followup: "", assignedTo: "" }));

  const drillActive = DRILL_KEYS.some((k) => filters[k]);
  const drillLabel = [
    filters.from || filters.to
      ? `Added ${filters.from ? fmtDate(filters.from) : "…"}–${filters.to ? fmtDate(filters.to) : "…"}`
      : null,
    filters.followup === "due" ? "Follow-up due" : null,
    filters.open === "1" ? "Open pipeline" : null,
    filters.assignedTo ? "one salesperson" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const findLead = (id) =>
    Object.values(kanban)
      .flatMap((c) => c.items || [])
      .find((l) => l._id === id);

  // Leads move forward-only (every role) — bounce a backward drag/drop before
  // the prompt opens.
  // Every drag opens a small prompt for an (optional) remark + next follow-up
  // date before the stage actually changes.
  const onMove = (id, status) => {
    const lead = findLead(id);
    if (!lead || lead.status === status) return;
    const blocked = moveBlocked(lead.status, status, lead.statusHistory);
    if (blocked) return toast.error(blocked);
    setStatusChange({ lead, toStatus: status });
  };

  // Dragging onto "Converted" opens the record-conversion flow instead — the
  // salesperson must enter how much was paid.
  const onConvert = (id) => {
    const lead = findLead(id);
    if (lead) setConvertLead(lead);
  };

  // Table view: the Stage cell is an inline dropdown. Picking a stage runs the
  // same flow as a Kanban drag — → Converted opens the conversion form, every
  // other move opens the remark / follow-up / session-picker modal.
  const onPickStage = (lead, toStatus) => {
    const blocked = moveBlocked(lead.status, toStatus, lead.statusHistory);
    if (blocked) return toast.error(blocked);
    if (toStatus === "converted") setConvertLead(lead);
    else setStatusChange({ lead, toStatus });
  };

  // One-step undo of a card's last move — straight from the board.
  const onUndo = async (lead) => {
    const hist = lead.statusHistory || [];
    const prev = hist.length >= 2 ? hist[hist.length - 2].status : null;
    if (!prev) return;
    try {
      await undoLeadStatus(lead._id);
      applyLocalMove(lead._id, prev, { statusRevertable: false });
      toast.success(`Moved back to ${LEAD_STATUS[prev]?.label || prev}.`);
    } catch (err) {
      toast.error(err);
    }
  };

  // Pull the next page of one column from the API and append it — keeps the
  // board light no matter how many leads a stage holds.
  const loadMoreColumn = useCallback(
    async (status) => {
      const col = kanban[status];
      if (!col || col.items.length >= col.total || colInFlight.current[status]) return;
      colInFlight.current[status] = true;
      setLoadingCols((m) => ({ ...m, [status]: true }));
      try {
        const res = await getKanbanColumn({
          ...cleanParams(),
          col: status,
          skip: col.items.length,
          limit: KANBAN_PAGE,
        });
        setKanban((prev) => {
          const cur = prev[status] || { items: [], total: 0 };
          const seen = new Set(cur.items.map((l) => l._id));
          const fresh = (res.items || []).filter((l) => !seen.has(l._id));
          const items = [...cur.items, ...fresh];
          // If a page brought nothing new, we've hit the real end — cap the
          // total so the auto-loader stops (guards against a count/find drift).
          const total = fresh.length === 0 ? items.length : res.total ?? cur.total;
          return { ...prev, [status]: { items, total } };
        });
      } catch (err) {
        toast.error(err);
      } finally {
        colInFlight.current[status] = false;
        setLoadingCols((m) => ({ ...m, [status]: false }));
      }
    },
    [kanban, cleanParams, toast]
  );

  // After a drag succeeds, move the card between columns in place instead of
  // refetching the whole board — so a deep scroll position isn't lost.
  const applyLocalMove = (leadId, toStatus, patch = {}) => {
    setKanban((prev) => {
      let moved;
      const next = {};
      for (const [s, col] of Object.entries(prev)) {
        const items = col.items || [];
        const idx = items.findIndex((l) => l._id === leadId);
        if (idx === -1) {
          next[s] = col;
        } else {
          moved = { ...items[idx], status: toStatus, ...patch };
          // Left "Converted"? the conversion is gone server-side — drop the
          // money fields so the card doesn't keep showing a green deal value.
          if (s === "converted" && toStatus !== "converted") {
            moved.dealValue = undefined;
            moved.amountReceived = undefined;
            moved.conversionId = undefined;
          }
          next[s] = { items: items.filter((_, i) => i !== idx), total: Math.max(0, (col.total || 1) - 1) };
        }
      }
      if (moved) {
        const dst = next[toStatus] || prev[toStatus] || { items: [], total: 0 };
        next[toStatus] = { items: [moved, ...dst.items], total: (dst.total || 0) + 1 };
      }
      return next;
    });
  };

  const ViewToggle = (
    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
      <button
        onClick={() => setView("kanban")}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
          view === "kanban" ? "bg-primary text-white" : "bg-white text-gray-600"
        }`}
      >
        <MdViewKanban size={16} /> Board
      </button>
      <button
        onClick={() => setView("table")}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
          view === "table" ? "bg-primary text-white" : "bg-white text-gray-600"
        }`}
      >
        <MdTableRows size={16} /> Table
      </button>
    </div>
  );

  const columns = [
    {
      key: "name",
      header: "Lead",
      render: (l) => (
        <div>
          <p className="font-medium text-gray-800">{l.name}</p>
          <p className="text-xs text-gray-400">{l.restaurantName || l.phone}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Stage",
      render: (l) => <LeadStageSelect lead={l} onPick={onPickStage} />,
    },
    { key: "source", header: "Source", render: (l) => LEAD_SOURCE[l.source]?.label || l.source },
    { key: "city", header: "City", render: (l) => l.city || "—" },
    { key: "assignedTo", header: "Owner", render: (l) => l.assignedTo?.name || "—" },
    {
      key: "potentialValue",
      header: "Value",
      align: "right",
      render: (l) => {
        const won = l.status === "converted" && l.dealValue != null;
        const amount = won ? l.dealValue : l.potentialValue;
        if (!amount) return "—";
        const unpaid = won && l.amountReceived != null && l.amountReceived < l.dealValue;
        return (
          <span
            className={won ? "text-green-600 font-semibold" : "text-gray-600"}
            title={won ? "Confirmed deal value" : "Estimated potential"}
          >
            {inrCompact(amount)}
            {unpaid && (
              <span
                className={`block text-[11px] font-normal ${
                  l.amountReceived === 0 ? "text-red-500" : "text-amber-600"
                }`}
              >
                {l.amountReceived === 0 ? "unpaid" : `${pct(l.amountReceived, l.dealValue)}% paid`}
              </span>
            )}
          </span>
        );
      },
    },
    { key: "createdAt", header: "Added", render: (l) => fmtDate(l.createdAt) },
  ];

  const goBack = () => (window.history.state?.idx > 0 ? nav(-1) : nav("/dashboard"));

  return (
    <div>
      {cameFromDrilldown && (
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <MdArrowBack size={16} /> Back
        </button>
      )}

      <PageHeader
        title="Leads"
        subtitle="Your pipeline from first contact to IFO conversion."
        actions={
          <>
            {ViewToggle}
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <MdUploadFile size={16} /> Import
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <MdAdd size={18} /> New lead
            </Button>
          </>
        }
      />

      <Card padding="p-3" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {!scoped && (
            <PeriodFilter value={period} onChange={(k) => { setPeriod(k); setPage(1); }} />
          )}
          <div className="relative flex-1 min-w-[200px]">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              placeholder="Search name, phone, brand, city…"
              value={filters.q}
              onChange={(e) => setFilter({ q: e.target.value })}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All stages</option>
            {optionsFrom(LEAD_STATUS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={filters.source}
            onChange={(e) => setFilter({ source: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All sources</option>
            {optionsFrom(LEAD_SOURCE).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {(filters.status || filters.source || filters.q) && (
            <button
              onClick={() => setFilters(emptyFilters)}
              className="text-sm text-gray-400 hover:text-gray-600 px-2"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {drillActive && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light/70 text-primary-dark px-3 py-1 font-medium">
            Showing: {drillLabel || "filtered"}
          </span>
          <button
            onClick={clearDrill}
            className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600"
          >
            <MdClose size={14} /> clear
          </button>
        </div>
      )}

      {view === "kanban" ? (
        loading ? (
          <Spinner />
        ) : (
          <KanbanBoard
            columns={kanban}
            onMove={onMove}
            onConvert={onConvert}
            onCardClick={(l) => nav(`/leads/${l._id}`)}
            onUndo={onUndo}
            onLoadMore={loadMoreColumn}
            loadingCols={loadingCols}
          />
        )
      ) : (
        <Card padding="p-2">
          <DataTable
            columns={columns}
            rows={table.data}
            loading={loading}
            onRowClick={(l) => nav(`/leads/${l._id}`)}
            empty={<EmptyState title="No leads match" message="Try a different filter, or add a lead." />}
          />
          <div className="px-2">
            <Pagination
              page={table.page}
              pages={table.pages}
              total={table.total}
              onChange={setPage}
            />
          </div>
        </Card>
      )}

      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={load} />
      <IfoFormModal
        open={!!convertLead}
        onClose={() => setConvertLead(null)}
        onSaved={load}
        presetLead={convertLead}
      />
      <StatusChangeModal
        open={!!statusChange}
        lead={statusChange?.lead}
        toStatus={statusChange?.toStatus}
        onClose={() => setStatusChange(null)}
        onDone={() => {
          if (!statusChange) return;
          // Board: move the card in place so a deep scroll survives. Table:
          // just refetch — a filtered row may now belong elsewhere.
          if (view === "kanban") {
            const now = new Date().toISOString();
            const { lead, toStatus } = statusChange;
            applyLocalMove(lead._id, toStatus, {
              // so the card shows "Undo" right away
              statusRevertable: true,
              statusChangedAt: now,
              statusHistory: [...(lead.statusHistory || []), { status: toStatus, at: now }],
            });
          } else load();
        }}
      />
    </div>
  );
}
