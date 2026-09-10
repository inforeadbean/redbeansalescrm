import { useEffect, useRef, useState } from "react";
import { MdSearch, MdClose } from "react-icons/md";
import { listLeads } from "../services/leadService.js";
import Badge from "./ui/Badge.jsx";
import { LEAD_STATUS } from "../utils/constants.js";

// Type-ahead lead search. `multiple` keeps a chip list; single mode calls
// onChange with one lead (or null). Used by the call scheduler, IFO create
// form, and webinar/event "add attendees".
export default function LeadPicker({ value, onChange, multiple = false, placeholder = "Search leads…" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const selected = multiple ? value || [] : value ? [value] : [];

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      listLeads({ q, limit: 8 })
        .then((r) => setResults(r.data))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (lead) => {
    if (multiple) {
      if (!selected.some((l) => l._id === lead._id)) onChange([...selected, lead]);
    } else {
      onChange(lead);
      setOpen(false);
    }
    setQ("");
  };
  const remove = (id) =>
    multiple ? onChange(selected.filter((l) => l._id !== id)) : onChange(null);

  return (
    <div className="relative" ref={boxRef}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((l) => (
            <span key={l._id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full pl-2 pr-1 py-1">
              {l.name}
              <button type="button" onClick={() => remove(l._id)} className="text-gray-400 hover:text-gray-600">
                <MdClose size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
          {results.map((l) => (
            <li key={l._id}>
              <button
                type="button"
                onClick={() => pick(l)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                <span>
                  <span className="font-medium text-gray-800">{l.name}</span>
                  <span className="text-gray-400"> · {l.restaurantName || l.phone}</span>
                </span>
                <Badge map={LEAD_STATUS} value={l.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
