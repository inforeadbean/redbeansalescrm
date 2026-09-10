// Form primitives sharing one look. Each forwards its ref so react-hook-form's
// {...register("x")} works directly:  <Input {...register("name")} error={...} />

import { forwardRef } from "react";

const base =
  "w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:bg-gray-50 disabled:text-gray-400 disabled:shadow-none";
const border = (error) => (error ? "border-red-400" : "border-gray-300 hover:border-gray-400");

export function FieldShell({ label, error, hint, required, children }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-xs text-red-500 mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-gray-400 mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef(function Input(
  { label, error, hint, required, className = "", ...props },
  ref
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <input ref={ref} className={`${base} ${border(error)} ${className}`} {...props} />
    </FieldShell>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className = "", rows = 3, ...props },
  ref
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <textarea ref={ref} rows={rows} className={`${base} ${border(error)} ${className}`} {...props} />
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, required, options = [], placeholder, children, className = "", ...props },
  ref
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <select ref={ref} className={`${base} ${border(error)} bg-white ${className}`} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  );
});
