import mongoose from "mongoose";

export const EVENT_STATUSES = ["upcoming", "completed", "cancelled"];
export const RSVP_STATUSES = ["invited", "confirmed", "declined"];

// A physical event (tasting, launch, meetup). Same embedded-list reasoning as
// Webinar.registrations — invitees are few, always read with their event, and
// carry an RSVP state on top of the attended flag.
const inviteeSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    rsvp: { type: String, enum: RSVP_STATUSES, default: "invited" },
    attended: { type: Boolean, default: false },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 5000 },
    venue: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: EVENT_STATUSES, default: "upcoming" },
    invitees: [inviteeSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
