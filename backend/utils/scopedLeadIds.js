import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import { leadScope } from "./scope.js";

// Given a list of lead ids from a request, return just the ones that (a) are
// well-formed ObjectIds, (b) point at a lead that actually exists, and (c) are
// in the caller's scope. Used by the webinar / event registration endpoints so
// a salesperson can't attach another team's leads — or bogus ids — and, as a
// side effect, write to their timelines.
export async function scopedLeadIds(user, ids) {
  const wanted = [...new Set((ids || []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!wanted.length) return [];
  const rows = await Lead.find({ _id: { $in: wanted }, ...(await leadScope(user)) })
    .select("_id")
    .lean();
  return rows.map((r) => String(r._id));
}
