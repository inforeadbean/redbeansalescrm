import IfoConversion from "../models/IfoConversion.js";
import { keepConvertedLeads } from "./convertedOnly.js";

const DAY = 86400000;
const OVERDUE_DAYS = 30; // no payment in this many days = needs chasing

// Every conversion that still owes money, newest-debt-first, with aging based on
// the last payment (or the conversion date if nothing has been paid yet).
export async function buildReceivables(salespersonIds, { type } = {}) {
  const match = {
    convertedBy: { $in: salespersonIds },
    $expr: { $lt: ["$amountReceived", "$dealValue"] },
  };
  if (typeof type === "string" && type) match.conversionType = type;

  const all = await IfoConversion.find(match)
    .populate("lead", "name phone restaurantName status")
    .populate("convertedBy", "name")
    .sort("-conversionDate")
    .lean();
  // Only debts on live clients — an orphaned conversion isn't money we're owed.
  const convs = keepConvertedLeads(all);

  const now = Date.now();
  const rows = convs.map((c) => {
    const outstanding = Math.max(0, (c.dealValue || 0) - (c.amountReceived || 0));
    const lastPaymentAt = (c.payments || []).reduce(
      (m, p) => (p.createdAt && (!m || new Date(p.createdAt) > new Date(m)) ? p.createdAt : m),
      null
    );
    const idleDays = Math.round((now - new Date(lastPaymentAt || c.conversionDate)) / DAY);
    return {
      _id: c._id,
      outletName: c.outletName,
      conversionType: c.conversionType,
      lead: c.lead && { _id: c.lead._id, name: c.lead.name, phone: c.lead.phone },
      owner: c.convertedBy?.name || "—",
      dealValue: c.dealValue || 0,
      amountReceived: c.amountReceived || 0,
      outstanding,
      paymentsCount: (c.payments || []).length,
      conversionDate: c.conversionDate,
      ageDays: Math.round((now - new Date(c.conversionDate)) / DAY),
      lastPaymentAt,
      idleDays,
      overdue: idleDays > OVERDUE_DAYS,
      nextInstallmentDate: c.nextInstallmentDate || null,
      nextInstallmentAmount: c.nextInstallmentAmount || null,
      nextInstallmentOverdue:
        c.nextInstallmentDate ? new Date(c.nextInstallmentDate) < now : false,
    };
  });
  rows.sort((a, b) => b.outstanding - a.outstanding);

  const bucketDefs = [
    ["0–30 days", 0, 30],
    ["31–60 days", 31, 60],
    ["61–90 days", 61, 90],
    ["90+ days", 91, Infinity],
  ];
  const aging = bucketDefs.map(([bucket, min, max]) => {
    const inB = rows.filter((r) => r.idleDays >= min && r.idleDays <= max);
    return { bucket, count: inB.length, amount: inB.reduce((s, r) => s + r.outstanding, 0) };
  });

  const overdue = rows.filter((r) => r.overdue);
  const sum = (xs, f) => xs.reduce((s, r) => s + f(r), 0);

  return {
    summary: {
      count: rows.length,
      totalOutstanding: sum(rows, (r) => r.outstanding),
      totalDeal: sum(rows, (r) => r.dealValue),
      totalCollected: sum(rows, (r) => r.amountReceived),
      overdueCount: overdue.length,
      overdueAmount: sum(overdue, (r) => r.outstanding),
      overdueDays: OVERDUE_DAYS,
      oldestDays: rows.length ? Math.max(...rows.map((r) => r.idleDays)) : 0,
    },
    aging,
    rows,
  };
}
