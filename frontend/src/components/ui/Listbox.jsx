import { useEffect, useRef, useState } from "react";
import { MdCheck, MdExpandMore } from "react-icons/md";

// A fully custom single-select dropdown — the browser's native <select>
// popup can't be styled (no rounded corners, no hover states, OS-themed
// highlight), so anywhere that mattered visually gets this instead. Same
// value/onChange contract as a native select, so it's a drop-in swap for a
// plain, non-form-registered dropdown (filters, pickers, inline pills).
//
// `options`: [{ value, label, dot? (a Tailwind bg-* class for a status dot) }]
// `renderTrigger(selected)`: replaces the default label+chevron button with a
// fully custom look (used by LeadStageSelect for its coloured pill).
export default function Listbox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
  buttonClassName = "",
  panelClassName = "",
  renderTrigger,
  align = "left",
  title,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    // Capture phase: another Listbox's own trigger calls stopPropagation() on
    // its mousedown (so it doesn't also fire a table row's onClick) — a
    // bubble-phase listener here would never see that event. Capture fires
    // on the way down, before any target's stopPropagation can block it, so
    // opening a second dropdown still reliably closes this one.
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIdx(Math.max(0, options.findIndex((o) => o.value === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (opt) => {
    setOpen(false);
    if (opt.value !== value) onChange(opt.value);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[activeIdx]) pick(options[activeIdx]);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={
          renderTrigger
            ? buttonClassName
            : // `buttonClassName`, when given, REPLACES (not merges with) the default
              // look below — Tailwind utilities don't reliably override each other by
              // string order, so mixing "rounded-lg ... rounded-md" would be a coin flip.
              `w-full flex items-center justify-between gap-2 text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed ${
                buttonClassName ||
                "rounded-lg border border-gray-300 bg-white shadow-sm px-3 py-2 text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60"
              }`
        }
      >
        {renderTrigger ? (
          renderTrigger(selected)
        ) : (
          <>
            <span className={`truncate ${selected ? "text-gray-800" : "text-gray-400"}`}>
              {selected ? selected.label : placeholder}
            </span>
            <MdExpandMore
              size={18}
              className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-50 mt-1.5 min-w-full w-max max-w-xs max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={(e) => {
                e.stopPropagation();
                pick(o);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                i === activeIdx ? "bg-primary-light/50" : ""
              } ${o.value === value ? "font-semibold text-gray-900" : "text-gray-700"}`}
            >
              {o.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.dot}`} />}
              <span className="truncate flex-1">{o.label}</span>
              {o.value === value && <MdCheck size={16} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
