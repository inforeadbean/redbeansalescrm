import { asyncHandler } from "../utils/asyncHandler.js";
import { activityScope, leadScope, scopedSalespeople } from "../utils/scope.js";
import Reminder from "../models/Reminder.js";
import Lead from "../models/Lead.js";
import Remark from "../models/Remark.js";

const isValidDate = (v) => v != null && !Number.isNaN(Date.parse(v));

// Who a new reminder should notify. A salesperson can only ever set one for
// themselves. A manager/admin may target anyone in their scope (the request
// body wins) and otherwise it falls to the lead's owner, then to themselves.
async function resolveRecipient(req, leadDoc) {
  if (req.user.role === "salesperson") return req.user._id;

  const ownerId = leadDoc?.assignedTo?._id || leadDoc?.assignedTo;
  const wanted = String(req.body.user || ownerId || req.user._id);
  if (wanted === String(req.user._id)) return req.user._id;

  const allowed = (await scopedSalespeople(req.user)).map(String);
  if (allowed.includes(wanted)) return wanted;
  return ownerId || req.user._id;
}

const fmtWhen = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// @route GET /api/reminders
//   ?view=bell        -> the caller's own due reminders, for the notification bell
//   ?lead=<id>        -> every in-scope reminder on that lead (for its panel)
//   (default)         -> the caller's own upcoming + recent reminders
export const listReminders = asyncHandler(async (req, res) => {
  if (req.query.view === "bell") {
    const filter = { user: req.user._id, remindAt: { $lte: new Date() } };
    const items = await Reminder.find(filter)
      .sort("-remindAt")
      .limit(30)
      .populate("lead", "name")
      .populate("createdBy", "name")
      .lean();
    return res.json({ items, unread: items.filter((r) => !r.readAt).length });
  }

  const filter = req.query.lead
    ? { lead: req.query.lead, ...(await activityScope(req.user, "user")) }
    : { user: req.user._id };

  const items = await Reminder.find(filter)
    .sort("remindAt")
    .limit(100)
    .populate("user", "name")
    .populate("createdBy", "name")
    .populate("lead", "name")
    .lean();
  res.json({ items });
});

// @route POST /api/reminders   { lead?, remindAt, note, user? }
export const createReminder = asyncHandler(async (req, res) => {
  const { lead, remindAt, note } = req.body;
  if (!note?.trim()) {
    res.status(400);
    throw new Error("A reminder note is required.");
  }
  if (!isValidDate(remindAt)) {
    res.status(400);
    throw new Error("A valid reminder date & time is required.");
  }

  let leadDoc = null;
  if (lead) {
    leadDoc = await Lead.findOne({ _id: lead, ...(await leadScope(req.user)) });
    if (!leadDoc) {
      res.status(404);
      throw new Error("Lead not found.");
    }
  }

  const user = await resolveRecipient(req, leadDoc);
  const reminder = await Reminder.create({
    lead: leadDoc?._id,
    user,
    createdBy: req.user._id,
    note: note.trim(),
    remindAt: new Date(remindAt),
  });

  // Leave a permanent line on the lead's timeline.
  if (leadDoc) {
    await Remark.create({
      lead: leadDoc._id,
      author: req.user._id,
      type: "system",
      text: `Reminder set for ${fmtWhen(remindAt)} — ${note.trim()}`,
    });
  }

  res.status(201).json(
    await reminder.populate([
      { path: "user", select: "name" },
      { path: "createdBy", select: "name" },
      { path: "lead", select: "name" },
    ])
  );
});

// @route PATCH /api/reminders/:id   { note?, remindAt? }  — reschedule / reword
export const updateReminder = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "user");
  const reminder = await Reminder.findOne({ _id: req.params.id, ...scope });
  if (!reminder) {
    res.status(404);
    throw new Error("Reminder not found.");
  }
  if (req.body.note !== undefined) {
    if (!req.body.note.trim()) {
      res.status(400);
      throw new Error("A reminder note is required.");
    }
    reminder.note = req.body.note.trim();
  }
  if (req.body.remindAt !== undefined) {
    if (!isValidDate(req.body.remindAt)) {
      res.status(400);
      throw new Error("A valid reminder date & time is required.");
    }
    reminder.remindAt = new Date(req.body.remindAt);
    reminder.readAt = undefined; // rescheduled — arm it afresh
  }
  await reminder.save();
  res.json(reminder);
});

// @route PATCH /api/reminders/:id/read   — recipient acknowledges it in the bell
export const markReminderRead = asyncHandler(async (req, res) => {
  await Reminder.updateOne(
    { _id: req.params.id, user: req.user._id, readAt: { $exists: false } },
    { readAt: new Date() }
  );
  res.json({ ok: true });
});

// @route POST /api/reminders/read-all
export const markAllRemindersRead = asyncHandler(async (req, res) => {
  await Reminder.updateMany(
    { user: req.user._id, remindAt: { $lte: new Date() }, readAt: { $exists: false } },
    { readAt: new Date() }
  );
  res.json({ ok: true });
});

// @route DELETE /api/reminders/:id   — cancel a pending one / clear a fired one
export const deleteReminder = asyncHandler(async (req, res) => {
  const scope = await activityScope(req.user, "user");
  const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, ...scope });
  if (!reminder) {
    res.status(404);
    throw new Error("Reminder not found.");
  }
  res.json({ ok: true });
});
