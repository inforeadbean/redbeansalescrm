import { MdChevronLeft, MdChevronRight } from "react-icons/md";

// Compact pager. Hidden entirely when there's only one page.
export default function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-gray-500">
      <span>
        Page <b className="text-gray-700">{page}</b> of {pages}
        {total != null && <span className="text-gray-400"> · {total} total</span>}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          <MdChevronLeft size={16} />
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          <MdChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
