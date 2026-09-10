import { useEffect, useRef, useState } from "react";
import KanbanCard from "./KanbanCard.jsx";
import { LEAD_STATUS, LEAD_STATUS_ORDER } from "../../utils/constants.js";

// Horizontal board, one column per lead status. `columns` is the API's
// { [status]: { items, total } } shape. Dropping a card on another column
// calls onMove(leadId, newStatus).
//
// Built to stay usable with thousands of leads: the board has a fixed height,
// every column scrolls on its own (header stays put), and a column keeps
// pulling the next page from the API (`onLoadMore(status)`) while you're near
// its bottom — so scrolling down a stage just reveals every card in it, no
// "load more" button and no "switch to table" dead end.
export default function KanbanBoard({
  columns,
  onMove,
  onConvert,
  onCardClick,
  onUndo,
  onLoadMore,
  loadingCols = {},
}) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const scrollers = useRef({});

  const maybeLoad = (status) => {
    const col = columns[status];
    const el = scrollers.current[status];
    if (!col || !el || loadingCols[status] || col.items.length >= col.total) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 700) onLoadMore?.(status);
  };

  // After each page lands, if a column is still scrolled near its bottom keep
  // going — one flick to the bottom cascades in the whole stage.
  useEffect(() => {
    LEAD_STATUS_ORDER.forEach(maybeLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, loadingCols]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 h-[calc(100dvh-15.5rem)] min-h-[420px]">
      {LEAD_STATUS_ORDER.map((status) => {
        const col = columns[status] || { items: [], total: 0 };
        const meta = LEAD_STATUS[status];
        const isOver = overCol === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(status);
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              setOverCol(null);
              setDragId(null);
              if (!id) return;
              // "Converted" always goes through the record-conversion flow.
              if (status === "converted") onConvert(id);
              else onMove(id, status);
            }}
            className={`w-64 shrink-0 rounded-xl border overflow-hidden flex flex-col h-full ${
              isOver ? "border-primary bg-primary-light/50" : `border-gray-100 ${meta.tint || "bg-gray-50"}`
            }`}
          >
            <div className={`h-1 ${meta.dot}`} />
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 shrink-0">
              <span className={`flex items-center gap-2 text-sm font-semibold ${meta.text || "text-gray-700"}`}>
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span className="text-xs font-medium text-gray-400 bg-white rounded-full px-1.5 py-0.5 border border-gray-100">
                {col.total}
              </span>
            </div>
            <div
              ref={(el) => (scrollers.current[status] = el)}
              onScroll={() => maybeLoad(status)}
              className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0"
            >
              {col.items.map((lead) => (
                <KanbanCard
                  key={lead._id}
                  lead={lead}
                  dragging={dragId === lead._id}
                  onClick={onCardClick}
                  onUndo={onUndo}
                  onDragStart={(l) => setDragId(l._id)}
                  onDragEnd={() => setDragId(null)}
                />
              ))}
              {col.items.length === 0 && !loadingCols[status] && (
                <p className="text-center text-xs text-gray-300 py-6">Drop here</p>
              )}
              {loadingCols[status] && (
                <p className="flex items-center justify-center gap-2 py-3 text-xs text-gray-400">
                  <span className="h-3 w-3 rounded-full border-2 border-gray-300 border-t-primary animate-spin" />
                  Loading…
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
