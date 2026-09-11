import mongoose from "mongoose";
import { emitSync } from "../realtime/io.js";

// The two kinds of win RBH started with, kept here only for the demo seed
// script. The real, extensible set of conversion types (any signed-in user
// can add more from Settings) lives in the ConversionType collection.
export const CONVERSION_TYPES = ["ifo", "rbc"];
export const CONVERSION_DEFAULT_VALUE = { ifo: 200000, rbc: 500000 };

// One money entry against a conversion. Deals are often paid in instalments,
// so instead of overwriting a single "amount received" number we append a
// payment each time — the full trail is then visible via the (i) button and
// mirrored onto the lead's remark timeline.
//
// `dueDate` is the instalment date that was scheduled when this payment came
// in (if any); `delayDays` is how many days late it was (0 = on time / no
// schedule). Both are stamped once at record time so the payment-delays report
// doesn't have to reconstruct history.
const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 2000 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: Date },
    delayDays: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The win record: a lead signed on as an IFO (₹2L standard) or an RBC (₹5L
// standard). Creating one flips the source Lead to `converted` (the controller
// does that + writes a system Remark) and only ever happens through the
// "record conversion" flow, which always asks how much has been paid.
//
// `dealValue` = total signed contract (revenue driver). `amountReceived` is
// kept as the running sum of `payments[]` — never written directly.
const conversionSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    // No enum here — the valid set now lives in the ConversionType collection
    // (admin/manager/salesperson can add to it from Settings), checked in the
    // controller rather than baked into the schema.
    conversionType: { type: String, default: "ifo", required: true, lowercase: true, trim: true },
    // Defaults to the lead's restaurant name / city (the controller fills them
    // in) — not asked for when recording a conversion.
    outletName: { type: String, trim: true, maxlength: 200 },
    outletCity: { type: String, trim: true, maxlength: 120 },
    dealValue: { type: Number, required: true, min: 0 },
    amountReceived: { type: Number, default: 0, min: 0 },
    payments: [paymentSchema],
    // When the next instalment is expected, and the salesperson's note about it.
    // Drives an "installment" reminder for the owner (see utils/installmentReminder).
    // Cleared once the deal is fully paid.
    nextInstallmentDate: { type: Date },
    nextInstallmentAmount: { type: Number, min: 0 },
    nextInstallmentNote: { type: String, trim: true, maxlength: 2000 },
    conversionDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

// Keep amountReceived in sync with the payment log.
conversionSchema.methods.recalcReceived = function recalcReceived() {
  this.amountReceived = this.payments.reduce((s, p) => s + (p.amount || 0), 0);
  return this.amountReceived;
};

// Real-time: a conversion touches money, the pipeline and the dashboard.
conversionSchema.post("save", (doc) =>
  emitSync(["conversions", "dashboard", "leads"], { users: [doc.convertedBy] })
);
conversionSchema.post("findOneAndDelete", (doc) => {
  if (doc) emitSync(["conversions", "dashboard", "leads"], { users: [doc.convertedBy] });
});

// Model name stays "IfoConversion" (collection "ifoconversions") so existing
// references don't churn — it covers both types now.
export default mongoose.model("IfoConversion", conversionSchema);
