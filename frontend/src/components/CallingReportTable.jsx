import { useState } from "react";
import { MdExpandMore, MdChevronRight } from "react-icons/md";
import { fmtDate } from "../utils/format.js";

// "Calling Sales Report" — Week 1-4 + Month Total, one sub-row per salesperson
// (same shape as the 5-for-3 board), actuals only: Leads added · Called (off
// "New") · <col per Zoom meeting this month>. A meeting runs in one week, so
// its number sits in that week's row. Event / Converted columns are left out
// on purpose — this report is Zoom-only.

function currentWeekOfMonth(month, year) {
  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month - 1 > now.getMonth())) return 0;
  if (year < now.getFullYear() || (year === now.getFullYear() && month - 1 < now.getMonth())) return 5;
  return Math.min(4, Math.ceil(now.getDate() / 7));
}

export default function CallingReportTable({ data }) {
  const [open, setOpen] = useState({});
  if (!data) return null;
  const { meetings, weeks, monthTotal } = data;
  const now = new Date();
  const curWeek = currentWeekOfMonth(data.month, data.year);

  // Dynamic middle columns — one per Zoom meeting this month, in date order.
  const dynCols = meetings
    .map((m) => ({ key: m.webinarId, bag: "zooms", title: m.title, when: m.scheduledAt }))
    .sort((a, b) => new Date(a.when) - new Date(b.when));

  const isOpen = (w) => open[w] ?? w <= curWeek;
  const toggle = (w) => setOpen((o) => ({ ...o, [w]: !isOpen(w) }));

  const numCells = (c, isTotal) => (
    <>
      <td className={numCls(isTotal)}>{c.leads}</td>
      <td className={numCls(isTotal)}>{c.called}</td>
      {dynCols.map((col) => (
        <td key={col.key} className={numCls(isTotal)}>
          {c[col.bag][col.key]}
        </td>
      ))}
    </>
  );

  const Block = ({ section, week, highlight }) => {
    const openW = week === "m" ? (open.m ?? false) : isOpen(week);
    const future = typeof week === "number" && week > curWeek;
    return (
      <>
        <tr
          className={`${highlight ? "bg-slate-200" : future ? "bg-slate-50" : "bg-slate-100"} cursor-pointer hover:bg-slate-200/80`}
          onClick={() => (week === "m" ? setOpen((o) => ({ ...o, m: !(o.m ?? false) })) : toggle(week))}
        >
          <td className="px-3 py-2.5 text-[13px] font-extrabold uppercase tracking-wide whitespace-nowrap border-r-2 border-slate-300 border-t border-slate-200 text-slate-800">
            <span className="inline-flex items-center gap-1">
              {openW ? <MdExpandMore size={16} /> : <MdChevronRight size={16} />}
              {section.label}
            </span>
          </td>
          <td className="px-3 py-2.5 text-[13px] font-extrabold uppercase text-slate-600 border-r border-slate-200 border-t border-slate-200">
            Total
          </td>
          {numCells(section.total, true)}
        </tr>
        {openW &&
          section.rows.map((r) => (
            <tr key={r.salespersonId} className="border-b border-slate-200 hover:bg-slate-50">
              <td className="border-r-2 border-slate-300 bg-white" />
              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-700 border-r border-slate-200 bg-white">
                {r.name}
              </td>
              {numCells(r)}
            </tr>
          ))}
      </>
    );
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] rounded-xl border-2 border-slate-400 overflow-hidden">
        <table className="w-full text-[15px] border-separate border-spacing-0">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-white bg-slate-700">
              <th className="px-3 py-3 text-left font-bold border-r border-slate-500" colSpan={2}>
                Week / Salesperson
              </th>
              <th className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight">
                Leads<span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">added</span>
              </th>
              <th className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight">
                Called<span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">off "New"</span>
              </th>
              {dynCols.map((col) => {
                const upcoming = new Date(col.when) > now;
                return (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight"
                  >
                    {col.title}
                    <span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">
                      {fmtDate(col.when)} · {upcoming ? "upcoming" : "attended"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {weeks.map((wk) => (
              <Block key={wk.week} section={wk} week={wk.week} />
            ))}
            <Block section={monthTotal} week="m" highlight />
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500 px-1">
        <b className="text-gray-600">Called</b> = leads moved off the "New" stage (contacted). A Zoom
        meeting's attended count sits in the week it runs.
        {dynCols.length === 0 && " No Zoom meeting is scheduled this month yet."}
      </p>
    </div>
  );
}

const numCls = (isTotal) =>
  `px-3 py-2.5 text-right tabular-nums border-t border-l border-slate-200 ${
    isTotal ? "text-slate-900 font-bold" : "text-slate-800"
  }`;
