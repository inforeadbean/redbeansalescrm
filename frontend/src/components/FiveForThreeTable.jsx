import { useState } from "react";
import { MdExpandMore, MdChevronRight } from "react-icons/md";
import { inrCompact } from "../utils/format.js";

// The "5 for 3 (Sales Person Wise)" board. `data` is the /reports/five-for-three
// payload: weeks[] + monthTotal, each with rows[] (per salesperson) + total.
// Columns follow the RBH funnel — Leads → Zoom → Event → Clients — then the
// money metrics. Every metric shows Pl (plan) vs Act (actual); the Act cell is
// tinted by how it tracks against Pl — green on/ahead, amber close, red behind.
//
// Weeks that haven't started yet in the selected month collapse to just their
// TOTAL row so the table stays scannable; click a week to expand it.
//
// Styling: a blue "banded columns" spreadsheet look — each metric group gets an
// alternating light/less-light blue vertical band so the seven groups stay
// visually separated across a wide table; the Act cells still carry the
// green/amber/red plan-vs-actual signal on top.

const METRICS = [
  { key: "leads", label: "No of Leads", fmt: (n) => n, sub: "target vs added" },
  { key: "webinar", label: "Zoom Candidates", fmt: (n) => n, sub: "interested → attended" },
  { key: "event", label: "Event Candidates", fmt: (n) => n, sub: "interested → attended" },
  { key: "clients", label: "No of Clients", fmt: (n) => n, sub: "course-interested → converted" },
  { key: "conversionRatio", label: "Conversion Ratio", fmt: (n) => `${n}%`, sub: "clients ÷ leads" },
  { key: "avgSale", label: "Avg ₹ Sale", fmt: inrCompact },
  { key: "revenue", label: "Revenue", fmt: inrCompact, sub: "target vs booked" },
];

// Alternating vertical band for metric group `i`, at three depths.
const band = (i, depth) => {
  const even = i % 2 === 0;
  if (depth === "head") return even ? "bg-blue-600" : "bg-blue-700";
  if (depth === "sub") return even ? "bg-blue-100" : "bg-blue-200";
  return even ? "bg-sky-50" : "bg-blue-50"; // body
};

function tint(act, pl) {
  if (pl == null || !pl) return null;
  const p = act / pl;
  if (p >= 0.98) return "bg-emerald-100 text-emerald-800";
  if (p >= 0.6) return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-800";
}

function cells(row) {
  return METRICS.flatMap((m, i) => {
    const c = row[m.key] || { pl: 0, act: 0 };
    const rag = tint(c.act, c.pl);
    return [
      <td
        key={m.key + "p"}
        className={`px-3 py-2 text-right tabular-nums text-blue-500 border-l-2 border-blue-300 ${band(i, "body")}`}
      >
        {c.pl == null ? "—" : m.fmt(c.pl)}
      </td>,
      <td
        key={m.key + "a"}
        className={`px-3 py-2 text-right tabular-nums font-bold border-l border-blue-200 ${
          rag || `${band(i, "body")} text-blue-900`
        }`}
      >
        {m.fmt(c.act)}
      </td>,
    ];
  });
}

function currentWeekOfMonth(month, year) {
  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month - 1 > now.getMonth())) return 0; // future month
  if (year < now.getFullYear() || (year === now.getFullYear() && month - 1 < now.getMonth())) return 5; // past month → all done
  return Math.min(4, Math.ceil(now.getDate() / 7));
}

export default function FiveForThreeTable({ data }) {
  const curWeek = data ? currentWeekOfMonth(data.month, data.year) : 5;
  const [open, setOpen] = useState({});
  if (!data) return null;

  const isOpen = (w) => open[w] ?? w <= curWeek;
  const toggle = (w) => setOpen((o) => ({ ...o, [w]: !isOpen(w) }));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1180px] rounded-xl border-2 border-blue-500 overflow-hidden">
        <table className="w-full text-[15px] border-separate border-spacing-0">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-white">
              <th
                className="px-3 py-3 text-left font-bold border-b-2 border-blue-300 bg-blue-800"
                colSpan={2}
              >
                Week / Salesperson
              </th>
              {METRICS.map((m, i) => (
                <th
                  key={m.key}
                  colSpan={2}
                  className={`px-3 py-3 text-center font-bold border-b-2 border-l-2 border-blue-300 leading-tight ${band(
                    i,
                    "head"
                  )}`}
                >
                  {m.label}
                  {m.sub && (
                    <span className="block text-[10px] normal-case text-blue-200 font-medium mt-0.5">
                      {m.sub}
                    </span>
                  )}
                </th>
              ))}
            </tr>
            <tr className="text-[11px] uppercase text-blue-800 font-semibold">
              <th className="border-b-2 border-blue-300 bg-blue-100" colSpan={2} />
              {METRICS.flatMap((m, i) => [
                <th
                  key={m.key + "p"}
                  className={`px-3 py-1.5 text-right border-b-2 border-l-2 border-blue-300 ${band(i, "sub")}`}
                >
                  Pl
                </th>,
                <th
                  key={m.key + "a"}
                  className={`px-3 py-1.5 text-right border-b-2 border-l border-blue-200 ${band(i, "sub")}`}
                >
                  Act
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((wk) => (
              <WeekBlock
                key={wk.week}
                section={wk}
                open={isOpen(wk.week)}
                onToggle={() => toggle(wk.week)}
                future={wk.week > curWeek}
              />
            ))}
            <WeekBlock
              section={data.monthTotal}
              open={isOpen("m")}
              onToggle={() => setOpen((o) => ({ ...o, m: !(o.m ?? false) }))}
              highlight
            />
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-3 px-1">
        <span>
          Leads / Revenue: <b className="text-gray-600">Pl</b> = monthly target ÷ 4. Zoom / Event / Clients
          are a running funnel — each lead is counted once in <i>every</i> stage it reached, in the week it got
          there. <b className="text-gray-600">Pl</b> = reached "interested", <b className="text-gray-600">Act</b> = reached "attended".
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> on / ahead of plan
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> 60–98%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> below 60%
        </span>
      </div>
    </div>
  );
}

function WeekBlock({ section, open, onToggle, highlight, future }) {
  const { rows, total } = section;
  return (
    <>
      <tr
        className={`${
          highlight ? "bg-blue-200" : future ? "bg-blue-50" : "bg-blue-100"
        } ${onToggle ? "cursor-pointer hover:bg-blue-200/80" : ""}`}
        onClick={onToggle}
      >
        <td
          className={`px-3 py-2.5 text-[13px] font-extrabold uppercase tracking-wide whitespace-nowrap border-r-2 border-blue-300 border-t border-blue-200 ${
            highlight ? "text-blue-900" : "text-blue-800"
          }`}
        >
          <span className="inline-flex items-center gap-1">
            {onToggle && (open ? <MdExpandMore size={17} /> : <MdChevronRight size={17} />)}
            {section.label}
          </span>
        </td>
        <td className="px-3 py-2.5 text-[13px] font-extrabold uppercase text-blue-600 border-r border-blue-200 border-t border-blue-200">
          Total
        </td>
        {cells(total)}
      </tr>
      {open &&
        rows.map((r) => (
          <tr key={r.salespersonId} className="border-b border-blue-200 hover:bg-sky-100/70">
            <td className="border-r-2 border-blue-300 bg-white" />
            <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-700 border-r border-blue-200 bg-white">
              {r.name}
            </td>
            {cells(r)}
          </tr>
        ))}
    </>
  );
}
