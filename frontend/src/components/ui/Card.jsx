export default function Card({ className = "", children, padding = "p-5" }) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_-2px_rgba(16,24,40,0.06)] ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
