import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/paginate.js";
import { activityScope, leadScope } from "../utils/scope.js";
import { syncFollowUpReminder } from "../utils/followupReminder.js";
import Call, { CALL_OUTCOMES } from "../models/Call.js";
import Lead from "../models/Lead.js";
import Remark from "../models/Remark.js";
import { CALL_OUTCOME_LABELS } from "../utils/labels.js";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

// @route GET /api/calls
export const listCalls = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "calledBy");
  const filter = { ...scope };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.lead) filter.lead = req.query.lead;
  if (req.query.from || req.query.to) {
    filter.scheduledAt = {};
    if (req.query.from) filter.scheduledAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.scheduledAt.$lte = new Date(req.query.to);
  }
  const result = await paginate(Call, filter, {
    query: req.query,
    sort: req.query.sort || "-scheduledAt",
    populate: [
      { path: "lead", select: "name phone restaurantName status" },
      { path: "calledBy", select: "name" },
    ],
  });
  res.json(result);
});

// @route GET /api/calls/today — the current user's call worklist
export const todayCalls = asyncHandler(async (req, res) => {
  const base = req.user.role === "salesperson" ? { calledBy: req.user._id } : await activityScope(req.user, "calledBy");
  const populate = [
    { path: "lead", select: "name phone restaurantName" },
    { path: "calledBy", select: "name" },
  ];
  const [today, overdue] = await Promise.all([
    Call.find({ ...base, status: "scheduled", scheduledAt: { $gte: startOfToday(), $lte: endOfToday() } })
      .sort("scheduledAt")
      .populate(populate)
      .lean(),
    Call.find({ ...base, status: "scheduled", scheduledAt: { $lt: startOfToday() } })
      .sort("scheduledAt")
      .populate(populate)
      .lean(),
  ]);
  res.json({ today, overdue });
});

// @route POST /api/calls   { lead, scheduledAt?, notes? }
export const createCall = asyncHandler(async (req, res) => {
  const { lead, scheduledAt, notes } = req.body;
  if (!lead) {
    res.status(400);
    throw new Error("lead is required.");
  }
  // Can only schedule calls against a lead you're allowed to see.
  const leadDoc = await Lead.findOne({ _id: lead, ...(await leadScope(req.user)) });
  if (!leadDoc) {
    res.status(404);
    throw new Error("Lead not found.");
  }
  const call = await Call.create({
    lead,
    calledBy: req.user.role === "salesperson" ? req.user._id : req.body.calledBy || leadDoc.assignedTo || req.user._id,
    scheduledAt: scheduledAt || Date.now(),
    notes,
    status: "scheduled",
  });
  res.status(201).json(await call.populate([{ path: "lead", select: "name phone" }, { path: "calledBy", select: "name" }]));
});

// @route PATCH /api/calls/:id/complete   { outcome, notes?, nextCallAt? }
export const completeCall = asyncHandler(async (req, res) => {
  const { outcome, notes, nextCallAt } = req.body;
  if (!CALL_OUTCOMES.includes(outcome)) {
    res.status(400);
    throw new Error(`outcome must be one of: ${CALL_OUTCOMES.join(", ")}`);
  }
  const scope = await activityScope(req.user, "calledBy");
  const call = await Call.findOne({ _id: req.params.id, ...scope });
  if (!call) {
    res.status(404);
    throw new Error("Call not found.");
  }
  call.status = "completed";
  call.completedAt = new Date();
  call.outcome = outcome;
  if (notes !== undefined) call.notes = notes;
  if (nextCallAt) call.nextCallAt = nextCallAt;
  await call.save();

  // Timeline entry on the lead.
  await Remark.create({
    lead: call.lead,
    author: req.user._id,
    type: "call",
    text: `Call — ${CALL_OUTCOME_LABELS[outcome] || outcome}${notes ? `: ${notes}` : ""}`,
  });

  // Book the follow-up call if one was requested.
  let followUp = null;
  if (nextCallAt) {
    followUp = await Call.create({
      lead: call.lead,
      calledBy: call.calledBy,
      scheduledAt: nextCallAt,
      status: "scheduled",
    });
    await Lead.updateOne({ _id: call.lead }, { nextFollowUpDate: nextCallAt });
    const leadDoc = await Lead.findById(call.lead);
    await syncFollowUpReminder(leadDoc, req.user._id);
  }

  res.json({ call, followUp });
});

// @route DELETE /api/calls/:id
export const deleteCall = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "calledBy");
  const call = await Call.findOneAndDelete({ _id: req.params.id, ...scope });
  if (!call) {
    res.status(404);
    throw new Error("Call not found.");
  }
  res.json({ message: "Call deleted." });
});
