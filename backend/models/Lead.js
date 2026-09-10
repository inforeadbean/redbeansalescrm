import mongoose from "mongoose";
import { emitSync } from "../realtime/io.js";

// The pipeline stages the calling team works, in funnel order — each "…_interested"
// stage is a lead the salesperson has lined up for that step, each "…_attended"
// stage is one who actually did it, and `converted` is a paying client. The 5-for-3
// report reads straight off these: interested → the column's Planned count, done →
// its Actual count. `converted`, `dead` and `invalid` are terminal; `followup` is a
// side bay for a lead that needs chasing. Kept as an exported, ordered array so
// controllers, the Kanban and the seed script all agree on the set and the order.
export const LEAD_STATUSES = [
  "new",
  "webinar_interested",
  "webinar_attended",
  "event_interested",
  "event_attended",
  "course_interested",
  "converted",
  "followup",
  "dead",
  "invalid",
];

// Terminal states — a lead here is out of the active pipeline.
export const LEAD_CLOSED = ["converted", "dead", "invalid"];

export const LEAD_SOURCES = [
  "webinar",
  "referral",
  "cold_call",
  "social",
  "walk_in",
  "other",
];

// A prospective Independent Food Operator. One salesperson owns a lead at a
// time (`assignedTo`); reassigning is an admin/manager action. The remark
// history lives in its own append-only `Remark` collection, not here, so the
// lead document stays small and a timeline can be paged independently.
// One rung on a lead's journey — the status it entered and when. The array is
// append-only and always starts with the "new" (or whatever it was created as)
// entry, so the funnel report can measure which stages a lead actually reached,
// how long it sat in each, and — for a dead lead — the stage it died at.
const statusStepSchema = new mongoose.Schema(
  { status: { type: String, required: true }, at: { type: Date, required: true } },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, lowercase: true, trim: true, maxlength: 200 },
    restaurantName: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    source: { type: String, enum: LEAD_SOURCES, default: "other" },
    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    // When `status` last changed — the 5-for-3 report buckets a lead into the
    // week it entered its current stage, so this is what it groups on (not
    // `updatedAt`, which also moves on a plain contact edit).
    statusChangedAt: { type: Date, default: Date.now, index: true },
    // Full stage history, oldest first. Maintained by the pre-save hook below;
    // existing leads are seeded by scripts/backfillStatusHistory.js.
    statusHistory: { type: [statusStepSchema], default: undefined },
    // True right after a stage change — powers the one-step "Undo last change"
    // (POST /leads/:id/undo-status). Set on every status move, cleared by the
    // undo itself, so exactly one undo is ever available and it can't chain.
    statusRevertable: { type: Boolean, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    nextFollowUpDate: { type: Date },
    potentialValue: { type: Number, default: 0, min: 0 },
    // Why a lead was closed as `dead` or `invalid`.
    lostReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

leadSchema.pre("save", function trackStatus(next) {
  if (this.isNew) {
    this.statusChangedAt = this.statusChangedAt || new Date();
    this.statusHistory = [{ status: this.status, at: this.statusChangedAt }];
  } else if (this.isModified("status")) {
    this.statusChangedAt = new Date();
    if (!Array.isArray(this.statusHistory)) this.statusHistory = [];
    this.statusHistory.push({ status: this.status, at: this.statusChangedAt });
  }
  next();
});

// Real-time: nudge the owner + all staff whenever a lead is written or removed.
leadSchema.post("save", (doc) => emitSync(["leads", "dashboard"], { users: [doc.assignedTo] }));
leadSchema.post("deleteOne", { document: true, query: false }, function () {
  emitSync(["leads", "dashboard"], { users: [this.assignedTo] });
});

export default mongoose.model("Lead", leadSchema);
