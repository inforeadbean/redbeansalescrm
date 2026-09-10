import mongoose from "mongoose";
import { emitSync } from "../realtime/io.js";

// A time-based nudge a user sets on a lead ("call Mamta back Friday 3pm").
// It fires purely by the passage of time — there is no server-side job. Once
// `remindAt` is in the past the reminder shows up in the recipient's
// notification bell; the frontend polls for that and also raises a desktop
// notification. `readAt` tracks whether the recipient has seen it in the bell;
// dismissing one deletes the row (its "Reminder set …" line stays on the lead
// timeline as the permanent record).
const reminderSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", index: true },
    // Who gets notified — defaults to the lead's owner, not necessarily the
    // person who created it (a manager can set a reminder for a salesperson).
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // "manual"      — someone set it by hand.
    // "followup"    — mirrors a lead's nextFollowUpDate.
    // "installment" — mirrors a conversion's nextInstallmentDate.
    // The last two are auto-managed: at most one per lead, rewritten/removed as
    // their source date changes.
    kind: { type: String, enum: ["manual", "followup", "installment"], default: "manual" },
    note: { type: String, required: true, trim: true, maxlength: 2000 },
    remindAt: { type: Date, required: true },
    // When the recipient first saw this in their bell — null while unread.
    readAt: { type: Date },
  },
  { timestamps: true }
);

// The bell query is "my reminders, due, oldest first"; the lead panel is
// "this lead's reminders by time" — both are covered by these.
reminderSchema.index({ user: 1, remindAt: 1 });

// Real-time: only the recipient cares about their own reminders.
reminderSchema.post("save", (doc) =>
  emitSync(["reminders"], { users: [doc.user], staff: false })
);
reminderSchema.post("findOneAndDelete", (doc) => {
  if (doc) emitSync(["reminders"], { users: [doc.user], staff: false });
});

export default mongoose.model("Reminder", reminderSchema);
