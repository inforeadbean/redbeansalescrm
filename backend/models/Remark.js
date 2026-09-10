import mongoose from "mongoose";

export const REMARK_TYPES = ["note", "status_change", "call", "system", "payment"];

// One entry in a lead's activity timeline. Append-only by design — there are
// no update/delete routes — so the history of what was said and when is a
// permanent record. `type` lets the UI style a manual note differently from
// an automatic "status changed new → contacted" line.
const remarkSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    type: { type: String, enum: REMARK_TYPES, default: "note" },
  },
  { timestamps: true }
);

export default mongoose.model("Remark", remarkSchema);
