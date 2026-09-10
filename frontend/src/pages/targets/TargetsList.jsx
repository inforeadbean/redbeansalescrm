import { useCallback, useEffect, useState } from "react";
import { MdSave } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import MonthPicker from "../../components/MonthPicker.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { MONTHS, inrCompact } from "../../utils/format.js";
import { listTargets, upsertTarget } from "../../services/targetService.js";

const FIELDS = [
  { key: "leadTarget", label: "Leads" },
  { key: "callTarget", label: "Calls" },
  { key: "conversionTarget", label: "Conversions" },
  { key: "revenueTarget", label: "Revenue (₹)" },
];

export default function TargetsList() {
  const toast = useToast();
  const [period, setPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows } = await listTargets(period);
      setRows(rows);
      const d = {};
      for (const r of rows) {
        d[r.salesperson._id] = Object.fromEntries(FIELDS.map((f) => [f.key, r[f.key] ?? 0]));
      }
      setDraft(d);
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const edit = (spId, key, val) =>
    setDraft((d) => ({ ...d, [spId]: { ...d[spId], [key]: val } }));

  const save = async (row) => {
    const spId = row.salesperson._id;
    setSavingId(spId);
    try {
      await upsertTarget({
        salesperson: spId,
        month: period.month,
        year: period.year,
        ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(draft[spId]?.[f.key]) || 0])),
      });
      toast.success(`Target saved for ${row.salesperson.name}.`);
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const dirty = (row) => {
    const spId = row.salesperson._id;
    return FIELDS.some((f) => Number(draft[spId]?.[f.key]) !== Number(row[f.key]));
  };

  return (
    <div>
      <PageHeader
        title="Targets"
        subtitle={`Monthly goals per salesperson — ${MONTHS[period.month - 1]} ${period.year}`}
        actions={<MonthPicker value={period} onChange={setPeriod} />}
      />

      <Card padding="p-2">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState title="No salespeople" message="Add team members first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2.5 px-3 font-medium">Salesperson</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="py-2.5 px-3 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const spId = row.salesperson._id;
                  return (
                    <tr key={spId}>
                      <td className="py-2 px-3 font-medium text-gray-800 whitespace-nowrap">
                        {row.salesperson.name}
                      </td>
                      {FIELDS.map((f) => (
                        <td key={f.key} className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            value={draft[spId]?.[f.key] ?? 0}
                            onChange={(e) => edit(spId, f.key, e.target.value)}
                            className="w-24 rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          {f.key === "revenueTarget" && (
                            <span className="ml-2 text-xs text-gray-400">
                              {inrCompact(draft[spId]?.[f.key] || 0)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right">
                        <Button
                          size="sm"
                          variant={dirty(row) ? "primary" : "secondary"}
                          disabled={!dirty(row) || savingId === spId}
                          onClick={() => save(row)}
                        >
                          <MdSave size={14} /> {savingId === spId ? "…" : "Save"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
