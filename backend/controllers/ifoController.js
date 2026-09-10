import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/paginate.js";
import { activityScope, leadScope } from "../utils/scope.js";
import IfoConversion, {
  CONVERSION_TYPES,
  CONVERSION_DEFAULT_VALUE,
} from "../models/IfoConversion.js";
import Lead, { LEAD_STATUSES } from "../models/Lead.js";
import Remark from "../models/Remark.js";
import Reminder from "../models/Reminder.js";
import { inr } from "../utils/money.js";
import { syncInstallmentReminder } from "../utils/installmentReminder.js";
import { dateRangeFilter } from "../utils/dateRange.js";

const DAY = 86400000;
const dmy = (d) => new Date(d).toLocaleDateString("en-IN");

// @route GET /api/conversions   (?type=ifo|rbc, ?from, ?to)
export const listIfo = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "convertedBy");
  const filter = { ...scope, ...dateRangeFilter("conversionDate", req.query.from, req.query.to) };
  if (CONVERSION_TYPES.includes(req.query.type)) filter.conversionType = req.query.type;

  const [result, agg] = await Promise.all([
    paginate(IfoConversion, filter, {
      query: req.query,
      sort: req.query.sort || "-conversionDate",
      select: "-payments",
      populate: [
        { path: "lead", select: "name restaurantName" },
        { path: "convertedBy", select: "name" },
      ],
    }),
    IfoConversion.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: "$dealValue" },
          collected: { $sum: "$amountReceived" },
          avg: { $avg: "$dealValue" },
          ifo: { $sum: { $cond: [{ $eq: ["$conversionType", "ifo"] }, 1, 0] } },
          rbc: { $sum: { $cond: [{ $eq: ["$conversionType", "rbc"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const a = agg[0] || {};
  res.json({
    ...result,
    summary: {
      count: a.count || 0,
      revenue: a.revenue || 0,
      collected: a.collected || 0,
      outstanding: (a.revenue || 0) - (a.collected || 0),
      avgDealValue: Math.round(a.avg || 0),
      ifo: a.ifo || 0,
      rbc: a.rbc || 0,
    },
  });
});

// @route GET /api/conversions/:id  — full record incl. payment history
export const getIfo = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "convertedBy");
  const ifo = await IfoConversion.findOne({ _id: req.params.id, ...scope })
    .populate("lead", "name restaurantName phone city")
    .populate("convertedBy", "name")
    .populate("payments.recordedBy", "name");
  if (!ifo) {
    res.status(404);
    throw new Error("Conversion not found.");
  }
  res.json(ifo);
});

// @route POST /api/conversions   { lead, conversionType, dealValue?, amountPaid? }
// The only way a lead becomes `converted`. Always records how much has been
// paid so far (as the first payment entry). Outlet name/city aren't asked for —
// they default to the lead's restaurant name / city.
export const createIfo = asyncHandler(async (req, res) => {
  const { lead } = req.body;
  const conversionType = CONVERSION_TYPES.includes(req.body.conversionType)
    ? req.body.conversionType
    : "ifo";
  const dealValue =
    req.body.dealValue != null && req.body.dealValue !== ""
      ? Math.max(0, Number(req.body.dealValue))
      : CONVERSION_DEFAULT_VALUE[conversionType];
  const amountPaid = Math.max(0, Number(req.body.amountPaid ?? req.body.amountReceived) || 0);

  if (!lead) {
    res.status(400);
    throw new Error("lead is required.");
  }
  const leadDoc = await Lead.findOne({ _id: lead, ...(await leadScope(req.user)) });
  if (!leadDoc) {
    res.status(404);
    throw new Error("Lead not found.");
  }
  if (await IfoConversion.findOne({ lead })) {
    res.status(409);
    throw new Error("This lead has already been converted.");
  }

  const outletName = (req.body.outletName || "").trim() || leadDoc.restaurantName || leadDoc.name;
  // A schedule only exists if there's still money owed AND a date — an amount or
  // note without a date is meaningless (nothing to remind on), so drop it.
  const hasSchedule = dealValue - amountPaid > 0 && !!req.body.nextInstallmentDate;
  const ifo = new IfoConversion({
    lead,
    convertedBy: leadDoc.assignedTo || req.user._id,
    conversionType,
    outletName,
    outletCity: req.body.outletCity || leadDoc.city,
    dealValue,
    conversionDate: req.body.conversionDate || Date.now(),
    notes: req.body.notes,
    payments: amountPaid > 0 ? [{ amount: amountPaid, note: "At conversion", recordedBy: req.user._id }] : [],
    nextInstallmentDate: hasSchedule ? new Date(req.body.nextInstallmentDate) : undefined,
    nextInstallmentAmount:
      hasSchedule && req.body.nextInstallmentAmount ? Math.max(0, Number(req.body.nextInstallmentAmount)) : undefined,
    nextInstallmentNote: hasSchedule ? (req.body.nextInstallmentNote || "").trim() || undefined : undefined,
  });
  ifo.recalcReceived();
  await ifo.save();
  await syncInstallmentReminder(ifo, req.user._id);

  leadDoc.status = "converted";
  await leadDoc.save();
  await Remark.create({
    lead,
    author: req.user._id,
    type: "system",
    text:
      `Converted (${conversionType.toUpperCase()}) — ${outletName}, deal ${inr(dealValue)}` +
      (amountPaid > 0 ? `, ${inr(amountPaid)} received` : ", nothing received yet") +
      (ifo.nextInstallmentDate ? `. Next instalment ${dmy(ifo.nextInstallmentDate)}` : ""),
  });

  res.status(201).json(
    await ifo.populate([
      { path: "lead", select: "name restaurantName" },
      { path: "convertedBy", select: "name" },
    ])
  );
});

// @route POST /api/conversions/:id/payments   { amount, note? }
// Log an instalment. Bumps amountReceived and drops a line on the lead timeline.
export const addPayment = asyncHandler(async (req, res) => {
  const amount = Math.max(0, Number(req.body.amount) || 0);
  if (!amount) {
    res.status(400);
    throw new Error("A payment amount is required.");
  }
  const scope = await activityScope(req.user, "convertedBy");
  const ifo = await IfoConversion.findOne({ _id: req.params.id, ...scope });
  if (!ifo) {
    res.status(404);
    throw new Error("Conversion not found.");
  }
  // Was this instalment late? Measured against whatever date was scheduled.
  const due = ifo.nextInstallmentDate;
  const delayDays = due ? Math.max(0, Math.round((Date.now() - new Date(due)) / DAY)) : 0;
  ifo.payments.push({
    amount,
    note: req.body.note?.trim(),
    recordedBy: req.user._id,
    dueDate: due,
    delayDays,
  });
  ifo.recalcReceived();

  // Re-schedule (or, once fully paid / left blank, clear) the next instalment.
  const stillOwed = ifo.dealValue - ifo.amountReceived > 0;
  if (stillOwed && req.body.nextInstallmentDate) {
    ifo.nextInstallmentDate = new Date(req.body.nextInstallmentDate);
    ifo.nextInstallmentAmount = req.body.nextInstallmentAmount
      ? Math.max(0, Number(req.body.nextInstallmentAmount))
      : undefined;
    ifo.nextInstallmentNote = (req.body.nextInstallmentNote || "").trim() || undefined;
  } else {
    ifo.nextInstallmentDate = undefined;
    ifo.nextInstallmentAmount = undefined;
    ifo.nextInstallmentNote = undefined;
  }
  await ifo.save();
  await syncInstallmentReminder(ifo, req.user._id);

  await Remark.create({
    lead: ifo.lead,
    author: req.user._id,
    type: "payment",
    text:
      `Payment recorded — ${inr(amount)}${req.body.note ? ` (${req.body.note.trim()})` : ""}` +
      (delayDays > 0 ? ` · ${delayDays} day${delayDays === 1 ? "" : "s"} late` : "") +
      `. Total received ${inr(ifo.amountReceived)} of ${inr(ifo.dealValue)}` +
      (ifo.nextInstallmentDate ? `. Next instalment ${dmy(ifo.nextInstallmentDate)}` : "") +
      ".",
  });

  res.status(201).json(await ifo.populate("payments.recordedBy", "name"));
});

// @route PUT /api/conversions/:id   — correct the record's details.
// `amountReceived` is NOT editable here (payments drive it); use /payments.
export const updateIfo = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "convertedBy");
  const ifo = await IfoConversion.findOne({ _id: req.params.id, ...scope });
  if (!ifo) {
    res.status(404);
    throw new Error("Conversion not found.");
  }
  if (req.body.conversionType && CONVERSION_TYPES.includes(req.body.conversionType))
    ifo.conversionType = req.body.conversionType;
  for (const k of ["outletName", "outletCity", "dealValue", "conversionDate", "notes"])
    if (req.body[k] !== undefined) ifo[k] = req.body[k];
  for (const k of ["nextInstallmentDate", "nextInstallmentAmount", "nextInstallmentNote"])
    if (req.body[k] !== undefined) ifo[k] = req.body[k] || undefined;
  // No date ⇒ no schedule: an orphan amount/note can't drive a reminder.
  if (!ifo.nextInstallmentDate) {
    ifo.nextInstallmentAmount = undefined;
    ifo.nextInstallmentNote = undefined;
  }
  ifo.dealValue = Math.max(0, Number(ifo.dealValue) || 0);
  await ifo.save();
  await syncInstallmentReminder(ifo, req.user._id);
  res.json(ifo);
});

// @route DELETE /api/conversions/:id   (admin, manager)
// Deleting a conversion un-does the sale: the lead is no longer a client, so
// it's walked back to the stage it was at just before it converted (from its
// history) — never left stranded at "converted" with no record. That keeps the
// board, dashboard and 5-for-3 report in agreement.
export const deleteIfo = asyncHandler(async (req, res) => {
  const ifo = await IfoConversion.findByIdAndDelete(req.params.id);
  if (!ifo) {
    res.status(404);
    throw new Error("Conversion not found.");
  }
  await Reminder.deleteMany({ lead: ifo.lead, kind: "installment" });

  const leadDoc = await Lead.findById(ifo.lead);
  if (leadDoc && leadDoc.status === "converted") {
    const hist = leadDoc.statusHistory || [];
    const convAt = hist.map((h) => h.status).lastIndexOf("converted");
    const prev = convAt > 0 ? hist[convAt - 1].status : null;
    leadDoc.status =
      prev && prev !== "converted" && LEAD_STATUSES.includes(prev) ? prev : "course_interested";
    await leadDoc.save();
    await Remark.create({
      lead: ifo.lead,
      author: req.user._id,
      type: "system",
      text: `Conversion deleted — lead moved back to "${leadDoc.status}". No longer counts toward revenue or clients.`,
    });
  }
  res.json({ message: "Conversion deleted." });
});
