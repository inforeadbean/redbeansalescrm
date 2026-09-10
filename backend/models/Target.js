import mongoose from "mongoose";

// One salesperson's goals for one calendar month. A salesperson can have a
// different target every month, so the natural key is (salesperson, month,
// year) — enforced unique so "set target" is a safe upsert. The weekly report
// prorates these (monthly ÷ 4.33); the monthly report compares against them
// directly.
const targetSchema = new mongoose.Schema(
  {
    salesperson: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    leadTarget: { type: Number, default: 0, min: 0 },
    callTarget: { type: Number, default: 0, min: 0 },
    conversionTarget: { type: Number, default: 0, min: 0 },
    revenueTarget: { type: Number, default: 0, min: 0 },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

targetSchema.index({ salesperson: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Target", targetSchema);
