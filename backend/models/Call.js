import mongoose from "mongoose";
import { emitSync } from "../realtime/io.js";

export const CALL_STATUSES = ["scheduled", "completed", "missed"];
export const CALL_OUTCOMES = [
  "connected",
  "no_answer",
  "busy",
  "not_interested",
  "callback",
  "converted",
];

// A single phone touch on a lead. Created as `scheduled` (with a `scheduledAt`),
// then closed via PATCH /calls/:id/complete which stamps `completedAt`,
// `outcome` and optionally books the next call (`nextCallAt`). A scheduled
// call whose time has passed without completion is surfaced as `missed`.
const callSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    calledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    scheduledAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date },
    status: { type: String, enum: CALL_STATUSES, default: "scheduled", index: true },
    outcome: { type: String, enum: CALL_OUTCOMES },
    notes: { type: String, trim: true, maxlength: 5000 },
    nextCallAt: { type: Date },
  },
  { timestamps: true }
);

callSchema.post("save", (doc) => emitSync(["calls", "dashboard"], { users: [doc.calledBy] }));
callSchema.post("findOneAndDelete", (doc) => {
  if (doc) emitSync(["calls", "dashboard"], { users: [doc.calledBy] });
});

export default mongoose.model("Call", callSchema);
