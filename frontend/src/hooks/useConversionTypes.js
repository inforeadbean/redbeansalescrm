import { useCallback, useEffect, useState } from "react";
import { listConversionTypes } from "../services/conversionTypeService.js";
import { CONVERSION_TYPE } from "../utils/constants.js";

// A few distinct badge looks to cycle through for a type beyond the two
// built-in ones — IFO / RBC keep their own fixed colours from CONVERSION_TYPE.
const PALETTE = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-slate-200 text-slate-700",
];

// The live, extensible list of conversion types (IFO/RBC plus anything added
// from Settings) — one shared fetch behind a hook so every screen that shows
// or picks a conversion type (the record-conversion form, the IFO/RBC filters,
// the type badge) reads the same list instead of the old hardcoded pair.
export default function useConversionTypes() {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return listConversionTypes()
      .then(setRaw)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const types = raw.map((t, i) => ({
    code: t.code,
    label: t.name,
    defaultValue: t.defaultValue || 0,
    color: CONVERSION_TYPE[t.code]?.color || PALETTE[i % PALETTE.length],
  }));
  const byCode = Object.fromEntries(types.map((t) => [t.code, t]));
  const options = types.map((t) => ({ value: t.code, label: t.label }));

  return { types, byCode, options, loading, reload };
}
