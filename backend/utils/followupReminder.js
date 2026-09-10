import Reminder from "../models/Reminder.js";

// Mirrors a lead's `nextFollowUpDate` into a single reminder for its owner, so
// the follow-up shows up in the notification bell like any other reminder.
// Call it after any save that could touch the follow-up date or the owner:
//   - date set / moved  -> the reminder is (re)written, and re-armed if it moved
//   - date cleared       -> the reminder is removed
// The lead's timeline already records follow-up changes, so this leaves no
// separate trail. `lead` is a Lead document; `actorId` is who triggered it.
export async function syncFollowUpReminder(lead, actorId) {
  if (!lead?._id) return;
  const filter = { lead: lead._id, kind: "followup" };

  const ownerId = lead.assignedTo?._id || lead.assignedTo;
  if (!lead.nextFollowUpDate || !ownerId) {
    await Reminder.deleteOne(filter);
    return;
  }

  const remindAt = new Date(lead.nextFollowUpDate);
  const existing = await Reminder.findOne(filter);
  if (existing) {
    const moved = existing.remindAt.getTime() !== remindAt.getTime();
    existing.remindAt = remindAt;
    existing.user = ownerId;
    existing.note = "Follow-up due";
    if (moved) existing.readAt = undefined; // a new date is a fresh nudge
    await existing.save();
  } else {
    await Reminder.create({
      lead: lead._id,
      kind: "followup",
      user: ownerId,
      createdBy: actorId,
      note: "Follow-up due",
      remindAt,
    });
  }
}
