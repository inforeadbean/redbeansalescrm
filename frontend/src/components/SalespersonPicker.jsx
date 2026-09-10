// A single select that slices the dashboard down to one salesperson. `value`
// is their id or "" for everyone; `people` is [{ _id, name }, ...].
export default function SalespersonPicker({ value, onChange, people }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white max-w-[180px]"
    >
      <option value="">All salespeople</option>
      {people.map((p) => (
        <option key={p._id} value={p._id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
