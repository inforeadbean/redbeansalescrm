// The Red Bean Hospitality "Food for Happiness" badge — supplied artwork
// (public/red-bean-badge.png, transparent). `size` is the rendered height in px.
export default function Logo({ className = "", size = 40 }) {
  return (
    <img
      src="/red-bean-badge.png"
      alt="Red Bean Hospitality — Food for Happiness"
      width={size}
      height={size}
      style={{ height: size, width: "auto" }}
      className={`block shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
