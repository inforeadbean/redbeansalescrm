import User from "../models/User.js";

// Every list/detail/aggregate query is filtered through one of these so the
// three roles see exactly what they should:
//   admin       -> everything (company-wide)
//   manager     -> their direct reports + themselves (their "team")
//   salesperson -> only their own records
// They return plain Mongo filter objects, so callers just spread them into a
// `.find({ ...scope, ...otherFilters })`.

// The user ids a manager owns: their direct reports plus themselves. One
// indexed query per request — fine at this scale; revisit with a cache if
// team sizes ever get large.
export async function teamIds(user) {
  const reports = await User.find({ manager: user._id }).select("_id").lean();
  return [user._id, ...reports.map((r) => r._id)];
}

// Filter for the Lead collection (keyed on `assignedTo`). An optional
// `personId` (already validated by resolveScopedPerson) narrows to just that
// one salesperson, overriding the normal role-based scope.
export async function leadScope(user, personId) {
  if (personId) return { assignedTo: personId };
  if (user.role === "admin") return {};
  if (user.role === "manager") return { assignedTo: { $in: await teamIds(user) } };
  return { assignedTo: user._id };
}

// Filter for an activity collection, keyed on whichever field holds the
// owning user — e.g. activityScope(user, "calledBy") for Call,
// activityScope(user, "convertedBy") for IfoConversion. Same optional
// `personId` narrowing as leadScope.
export async function activityScope(user, field, personId) {
  if (personId) return { [field]: personId };
  if (user.role === "admin") return {};
  if (user.role === "manager") return { [field]: { $in: await teamIds(user) } };
  return { [field]: user._id };
}

// Filter for the User collection itself (the Sales Team page). A manager sees
// their reports and their own row; a salesperson sees only themselves.
export async function userScope(user) {
  if (user.role === "admin") return {};
  if (user.role === "manager") return { $or: [{ manager: user._id }, { _id: user._id }] };
  return { _id: user._id };
}

// The set of salesperson ids a report/dashboard should aggregate over.
export async function scopedSalespeople(user) {
  if (user.role === "salesperson") return [user._id];
  const filter = user.role === "manager" ? { manager: user._id } : { role: "salesperson" };
  const rows = await User.find(filter).select("_id name").lean();
  return rows.map((r) => r._id);
}

// Resolves an optional `?salesperson=<id>` dashboard slicer to a validated id
// (or null for "everyone"). The id must be one the caller is already scoped
// to — a manager can't use it to peek at another team's numbers.
export async function resolveScopedPerson(user, queryId) {
  if (!queryId) return null;
  const allowed = await scopedSalespeople(user);
  const match = allowed.find((id) => String(id) === String(queryId));
  if (!match) {
    const err = new Error("That salesperson is outside your scope.");
    err.status = 403;
    throw err;
  }
  return match;
}
