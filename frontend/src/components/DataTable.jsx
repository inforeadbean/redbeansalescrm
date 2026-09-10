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
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`py-2.5 px-3 font-medium ${c.align === "right" ? "text-right" : ""} ${c.headerClassName || ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""} transition-colors`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`py-3 px-3 text-gray-700 align-middle ${c.align === "right" ? "text-right" : ""} ${c.className || ""}`}
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
