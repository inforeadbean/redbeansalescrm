const VARIANTS = {
  primary:
    "bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary-dark hover:shadow-md hover:shadow-primary/25 disabled:opacity-60 disabled:shadow-none",
  secondary:
    "bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400 disabled:opacity-60 disabled:shadow-none",
  danger:
    "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 hover:shadow-md hover:shadow-red-600/20 disabled:opacity-60 disabled:shadow-none",
  ghost: "text-gray-600 hover:bg-gray-100 disabled:opacity-60",
};
const SIZES = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

export default function Button({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <Comp
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all active:scale-[0.98] ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}
