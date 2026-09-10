// Red / Yellow / Green rating used by the Weekly and Monthly reports.
// green  = on or ahead of target (>= 90%)
// yellow = close        (60–89%)
// red    = behind        (< 60%)
export function ryg(actual, target) {
  if (!target) return { key: "none", label: "No target", color: "bg-gray-100 text-gray-500", pctValue: 0 };
  const p = Math.round((actual / target) * 100);
  if (p >= 90) return { key: "green", label: "On track", color: "bg-green-100 text-green-700", pctValue: p };
  if (p >= 60) return { key: "yellow", label: "At risk", color: "bg-amber-100 text-amber-700", pctValue: p };
  return { key: "red", label: "Behind", color: "bg-red-100 text-red-700", pctValue: p };
}

// A month's target, prorated to a single week. 4.33 = avg weeks per month.
export const weeklyShare = (monthlyTarget) => Math.round((monthlyTarget || 0) / 4.33);

// Chart-friendly funnel: attach conversion % vs the previous stage.
export function funnelWithRates(stages) {
  return stages.map((s, i) => ({
    ...s,
    rate: i === 0 || !stages[i - 1].value ? 100 : Math.round((s.value / stages[i - 1].value) * 100),
  }));
}
