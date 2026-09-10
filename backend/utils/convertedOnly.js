// Every client / revenue number in the app is rolled up from `IfoConversion`
// records. The invariant is: a conversion exists **only** while its lead sits
// at status "converted" (createIfo sets it; updateLeadStatus and deleteIfo
// walk it back). This module is the safety net for that invariant — if a
// conversion is ever orphaned (a lead moved out of "converted" by a code path
// that forgot to cascade, a legacy row, a direct DB edit) it must not keep
// inflating revenue, client counts, the leaderboard or the 5-for-3 report.

// Aggregation stages: join the lead and keep only conversions whose lead is
// still "converted". Drop the temp field afterwards so downstream $group /
// $project stay clean.
export const convertedLeadStages = [
  { $lookup: { from: "leads", localField: "lead", foreignField: "_id", as: "_lead" } },
  { $match: { "_lead.status": "converted" } },
  { $unset: "_lead" },
];

// For `.find()` callers: pass the fetched conversions (each with `lead`
// populated to at least `status`) and get back only the live ones.
export const keepConvertedLeads = (convs) =>
  convs.filter((c) => c.lead && c.lead.status === "converted");
