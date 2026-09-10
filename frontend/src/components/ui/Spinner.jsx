export default function Spinner({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-10 text-sm text-gray-400 ${className}`}>
      <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-primary animate-spin" />
      {label}
    </div>
  );
}
