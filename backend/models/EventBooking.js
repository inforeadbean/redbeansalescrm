import mongoose from "mongoose";

// A small deposit a lead pays to reserve a seat at an event — collected when
// the salesperson moves them from "Zoom 1 Attended" to "Interested for event".
// Separate from the IfoConversion (the actual course sale); this is just the
// booking money, reported on its own.
const eventBookingSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    amount: { type: Number, required: true, min: 0 },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    note: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

export default mongoose.model("EventBooking", eventBookingSchema);
