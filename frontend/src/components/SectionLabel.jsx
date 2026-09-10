// A quiet divider + label between groups of cards on a long page.
export default function SectionLabel({ children, hint }) {
  return (
    <div className="flex items-center gap-3 mt-7 mb-3 first:mt-0">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500 shrink-0">
        {children}
      </h2>
      <span className="h-px bg-gray-200 flex-1" />
      {hint && <span className="text-xs font-semibold text-gray-500 shrink-0">{hint}</span>}
    </div>
  );
}
