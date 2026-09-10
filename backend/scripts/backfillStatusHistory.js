import mongoose from "mongoose";
import dotenv from "dotenv";
import Lead from "../models/Lead.js";
import Remark from "../models/Remark.js";
import IfoConversion from "../models/IfoConversion.js";
import { LEAD_STATUS_LABELS } from "../utils/labels.js";

// One-time (idempotent) migration: give every existing lead a `statusHistory`
// reconstructed from its `status_change` remarks + conversion date. New leads
// get theirs from the Lead pre-save hook, so this only needs to run once after
// deploying that hook — but it's safe to re-run.
//
//   node scripts/backfillStatusHistory.js            # fill only leads missing it
//   node scripts/backfillStatusHistory.js --rebuild  # rebuild all leads

dotenv.config();

const REBUILD = process.argv.includes("--rebuild");
const LABEL_TO_STATUS = Object.fromEntries([
  ...Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => [v.toLowerCase(), k]),
  // Labels that have since been renamed — old remarks still carry the old text.
  ["interested for webinar", "webinar_interested"],
  ["webinar attended", "webinar_attended"],
]);

// "Status changed: New → Webinar attended — note · follow-up 1/2/26" → "webinar_attended"
function targetStatusFromRemark(text) {
  const m = /→\s*([^—·\n]+?)\s*(?:—|·|$)/.exec(text || "");
  if (!m) return null;
  return LABEL_TO_STATUS[m[1].trim().toLowerCase()] || null;
}

async function run() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rbh_sales_crm";
  await mongoose.connect(uri);
  console.log(`[backfill] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const filter = REBUILD ? {} : { statusHistory: { $in: [null, []] } };
  const leads = await Lead.find(filter).lean();
  console.log(`[backfill] ${leads.length} lead(s) to process${REBUILD ? " (rebuild)" : ""}`);

  let done = 0;
  for (const lead of leads) {
    const steps = [{ status: "new", at: lead.createdAt || lead.statusChangedAt || new Date() }];

    const changes = await Remark.find({ lead: lead._id, type: "status_change" })
      .sort("createdAt")
      .lean();
    for (const r of changes) {
      const s = targetStatusFromRemark(r.text);
      if (s && s !== steps[steps.length - 1].status) steps.push({ status: s, at: r.createdAt });
    }

    if (lead.status === "converted" && !steps.some((s) => s.status === "converted")) {
      const conv = await IfoConversion.findOne({ lead: lead._id }).select("conversionDate").lean();
      steps.push({ status: "converted", at: conv?.conversionDate || lead.statusChangedAt || new Date() });
    }

    // Make sure the history ends on the lead's real current status.
    if (steps[steps.length - 1].status !== lead.status) {
      steps.push({ status: lead.status, at: lead.statusChangedAt || new Date() });
    }

    await Lead.updateOne({ _id: lead._id }, { $set: { statusHistory: steps } });
    done++;
  }

  console.log(`[backfill] updated ${done} lead(s)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
