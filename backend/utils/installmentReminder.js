import Reminder from "../models/Reminder.js";
import { inr } from "./money.js";

// Mirrors a conversion's `nextInstallmentDate` into a reminder for the person
// who closed it, so the next payment lands in their notification bell. One per
// conversion (kind:"installment", keyed on the lead), rewritten when the date
// moves and removed once the deal is fully paid or the schedule is cleared.
// `conv` is an IfoConversion document; `actorId` is who triggered the change.
export async function syncInstallmentReminder(conv, actorId) {
  if (!conv?.lead) return;
  const filter = { lead: conv.lead, kind: "installment" };

  const outstanding = (conv.dealValue || 0) - (conv.amountReceived || 0);
  const ownerId = conv.convertedBy?._id || conv.convertedBy;

  if (!conv.nextInstallmentDate || outstanding <= 0 || !ownerId) {
    await Reminder.deleteOne(filter);
    return;
  }

  const bits = ["Instalment due"];
  if (conv.nextInstallmentAmount) bits.push(inr(conv.nextInstallmentAmount));
  const head = bits.join(" — ");
  const note = conv.nextInstallmentNote ? `${head} · ${conv.nextInstallmentNote}` : head;
  const remindAt = new Date(conv.nextInstallmentDate);

  const existing = await Reminder.findOne(filter);
  if (existing) {
    const moved = existing.remindAt.getTime() !== remindAt.getTime();
    existing.remindAt = remindAt;
    existing.user = ownerId;
    existing.note = note;
    if (moved) existing.readAt = undefined;
    await existing.save();
  } else {
    await Reminder.create({
      lead: conv.lead,
      kind: "installment",
      user: ownerId,
      createdBy: actorId,
      note,
      remindAt,
    });
  }
}
