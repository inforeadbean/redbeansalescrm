export default function Card({ className = "", children, padding = "p-5" }) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.04)] ${padding} ${className}`}
    >
      {children}
    </div>
  );
}
