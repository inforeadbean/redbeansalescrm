import mongoose from "mongoose";

export const WEBINAR_STATUSES = ["upcoming", "completed", "cancelled"];

// Registrations are embedded rather than a separate collection: a webinar has
// at most a few hundred, they are only ever read alongside their webinar, and
// "who attended" is a checkbox pass done once after the session. Each still
// gets its own _id so the UI can address one row for the attended toggle.
const registrationSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    registeredAt: { type: Date, default: Date.now },
    attended: { type: Boolean, default: false },
  },
  { _id: true }
);

const webinarSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 5000 },
    scheduledAt: { type: Date, required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: WEBINAR_STATUSES, default: "upcoming" },
    registrations: [registrationSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Webinar", webinarSchema);
