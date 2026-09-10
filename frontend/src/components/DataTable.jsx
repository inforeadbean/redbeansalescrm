import Spinner from "./ui/Spinner.jsx";
import EmptyState from "./ui/EmptyState.jsx";

// Generic table. `columns` is [{ key, header, render?, className?, align? }].
// `render(row)` overrides the default `row[key]`. `onRowClick` makes rows
// clickable. Keeps markup minimal — pagination is a separate component below it.
export default function DataTable({
  columns,
  rows,
  loading,
  keyField = "_id",
  onRowClick,
  empty,
}) {
  if (loading) return <Spinner />;
  if (!rows?.length) return empty || <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-[#64748b] bg-gray-50/80">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`py-3 px-3.5 border-b border-gray-200 first:rounded-tl-xl last:rounded-tr-xl ${c.align === "right" ? "text-right" : ""} ${c.headerClassName || ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? "cursor-pointer hover:bg-primary-light/25" : ""} transition-colors`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`py-3.5 px-3.5 text-gray-700 align-middle border-b border-gray-100 ${
                    c.align === "right" ? "text-right" : ""
                  } ${c.className || ""}`}
                >
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
