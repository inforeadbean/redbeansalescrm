// INR formatting for the few places the backend emits prose containing money
// (auto-written remarks, report export cells). The frontend has its own
// richer formatter for display.
export function inr(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
