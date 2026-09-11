import { useState } from "react";
import { MdExpandMore, MdChevronRight } from "react-icons/md";
import { fmtDate } from "../utils/format.js";

// "Calling Sales Report" — one sub-row per salesperson for whichever week is
// picked up top (the Week filter, next to the month picker), plus a Month
// Total block that always sits last. Zoom AND Event columns are dynamic — one
// per non-cancelled Zoom meeting / Event this month, in date order.

export function currentWeekOfMonth(month, year) {
  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month - 1 > now.getMonth())) return 0;
  if (year < now.getFullYear() || (year === now.getFullYear() && month - 1 < now.getMonth())) return 5;
  return Math.min(4, Math.ceil(now.getDate() / 7));
}

export default function CallingReportTable({ data, week }) {
  const [monthOpen, setMonthOpen] = useState(false);
  if (!data) return null;
  const { meetings, events, weeks, monthTotal } = data;
  const now = new Date();
  const curWeek = currentWeekOfMonth(data.month, data.year);

  // Dynamic middle columns — one per Zoom meeting and one per Event this
  // month, merged into a single date-ordered timeline.
  const dynCols = [
    ...meetings.map((m) => ({ key: m.webinarId, bag: "zooms", kind: "Zoom", title: m.title, when: m.scheduledAt })),
    ...events.map((e) => ({ key: e.eventId, bag: "events", kind: "Event", title: e.title, when: e.date })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when));

  const selectedWeek = weeks.find((w) => w.week === week) || weeks[0];

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

  const Block = ({ section, highlight, future, open, onToggle }) => (
    <>
      <tr
        className={`${highlight ? "bg-slate-200" : future ? "bg-slate-50" : "bg-slate-100"} ${
          onToggle ? "cursor-pointer hover:bg-slate-200/80" : ""
        }`}
        onClick={onToggle}
      >
        <td className="px-3 py-2.5 text-[13px] font-extrabold uppercase tracking-wide whitespace-nowrap border-r-2 border-slate-300 border-t border-slate-200 text-slate-800">
          <span className="inline-flex items-center gap-1">
            {onToggle ? open ? <MdExpandMore size={16} /> : <MdChevronRight size={16} /> : null}
            {section.label}
          </span>
        </td>
        <td className="px-3 py-2.5 text-[13px] font-extrabold uppercase text-slate-600 border-r border-slate-200 border-t border-slate-200">
          Total
        </td>
        {numCells(section.total, true)}
      </tr>
      {(onToggle ? open : true) &&
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
                Total Leads<span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">added</span>
              </th>
              <th className="px-3 py-3 text-right font-bold border-l border-slate-500 leading-tight">
                Total Called<span className="block text-[10px] normal-case text-slate-300 font-medium mt-0.5">off "New"</span>
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
                      {fmtDate(col.when)} · {col.kind} · {upcoming ? "upcoming" : "attended"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <Block section={selectedWeek} future={week > curWeek} />
            <Block
              section={monthTotal}
              highlight
              open={monthOpen}
              onToggle={() => setMonthOpen((o) => !o)}
            />
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500 px-1">
        <b className="text-gray-600">Total Called</b> = leads moved off the "New" stage (contacted). A
        Zoom meeting's or Event's attended count sits in the week it ran.
        {dynCols.length === 0 && " No Zoom meeting or Event is scheduled this month yet."}
      </p>
    </div>
  );
}

const numCls = (isTotal) =>
  `px-3 py-2.5 text-right tabular-nums border-t border-l border-slate-200 ${
    isTotal ? "text-slate-900 font-bold" : "text-slate-800"
  }`;
