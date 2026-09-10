import Listbox from "./ui/Listbox.jsx";

// A single select that slices the dashboard down to one salesperson. `value`
// is their id or "" for everyone; `people` is [{ _id, name }, ...].
export default function SalespersonPicker({ value, onChange, people }) {
  return (
    <Listbox
      value={value}
      onChange={onChange}
      className="w-44"
      options={[{ value: "", label: "All salespeople" }, ...people.map((p) => ({ value: p._id, label: p.name }))]}
    />
  );
}
