import IfoConversion from "../models/IfoConversion.js";
import { keepConvertedLeads } from "./convertedOnly.js";

const DAY = 86400000;

// Every payment that came in late, plus every scheduled instalment that is now
// overdue and still unpaid — with a per-salesperson roll-up so a manager can
// see who is slipping and by how many days.
export async function buildPaymentDelays(salespersonIds) {
  const all = await IfoConversion.find({ convertedBy: { $in: salespersonIds } })
    .populate("lead", "name status")
    .populate("convertedBy", "name")
    .lean();
  const convs = keepConvertedLeads(all);

  const now = Date.now();
  const items = [];

  for (const c of convs) {
    const owner = c.convertedBy?.name || "—";

    for (const p of c.payments || []) {
      if (p.delayDays > 0) {
        items.push({
          conversionId: c._id,
          outlet: c.outletName,
          client: c.lead?.name || "—",
          owner,
          amount: p.amount || 0,
          dueDate: p.dueDate,
          settledDate: p.createdAt,
          delayDays: p.delayDays,
          status: "paid_late",
        });
      }
    }

    const outstanding = (c.dealValue || 0) - (c.amountReceived || 0);
    if (c.nextInstallmentDate && outstanding > 0 && new Date(c.nextInstallmentDate) < now) {
      items.push({
        conversionId: c._id,
        leadId: c.lead?._id || null,
        outlet: c.outletName,
        client: c.lead?.name || "—",
        owner,
        amount: c.nextInstallmentAmount || outstanding,
        dueDate: c.nextInstallmentDate,
        settledDate: null,
        delayDays: Math.round((now - new Date(c.nextInstallmentDate)) / DAY),
        status: "pending",
      });
    }
  }

  items.sort((a, b) => b.delayDays - a.delayDays);

  const byOwner = {};
  for (const it of items) {
    const o = (byOwner[it.owner] ||= {
      name: it.owner, count: 0, paidLate: 0, pending: 0, totalDelay: 0, maxDelayDays: 0, amount: 0,
    });
    o.count++;
    if (it.status === "paid_late") o.paidLate++;
    else o.pending++;
    o.totalDelay += it.delayDays;
    o.maxDelayDays = Math.max(o.maxDelayDays, it.delayDays);
    o.amount += it.amount || 0;
  }
  const bySalesperson = Object.values(byOwner)
    .map((o) => ({
      name: o.name,
      count: o.count,
      paidLate: o.paidLate,
      pending: o.pending,
      avgDelayDays: Math.round(o.totalDelay / o.count),
      maxDelayDays: o.maxDelayDays,
      amount: o.amount,
    }))
    .sort((a, b) => b.avgDelayDays - a.avgDelayDays);

  const paidLate = items.filter((i) => i.status === "paid_late");
  const totalDelay = items.reduce((s, i) => s + i.delayDays, 0);

  return {
    summary: {
      total: items.length,
      paidLateCount: paidLate.length,
      pendingCount: items.length - paidLate.length,
      avgDelayDays: items.length ? Math.round(totalDelay / items.length) : 0,
      maxDelayDays: items.length ? Math.max(...items.map((i) => i.delayDays)) : 0,
      delayedAmount: items.reduce((s, i) => s + (i.amount || 0), 0),
    },
    bySalesperson,
    items,
  };
}
