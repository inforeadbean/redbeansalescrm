import mongoose from "mongoose";

// The kinds of "won" deal RBH can book — starts as just IFO and RBC, but any
// signed-in user (admin, manager or salesperson) can add another one from
// Settings when a new business line needs its own bucket. `code` is what's
// actually stored on IfoConversion.conversionType — stable even if `name` is
// later retitled, and how existing IFO/RBC records stay matched to whichever
// document currently represents them (see ensureDefaults in the controller).
const conversionTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 40 },
    defaultValue: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("ConversionType", conversionTypeSchema);
