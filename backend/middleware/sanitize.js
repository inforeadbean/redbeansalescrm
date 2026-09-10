// Strip MongoDB query operators out of anything that came from the client.
//
// Express's `qs` parser turns `?role[$ne]=x` into `{ role: { $ne: "x" } }`, and
// a JSON body can carry the same shapes. Spread straight into a Mongoose query
// that becomes an operator injection — e.g. `{ email: { $ne: null } }` to match
// the first user, or `{ $where: "…" }`. We never legitimately accept a key that
// starts with `$` or contains a `.` from the client, so we drop those keys
// (in place — Express 4's `req.query` getter can't be reassigned) before any
// route sees them.
function scrub(value, depth = 0) {
  if (depth > 20 || value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v) => scrub(v, depth + 1));
    return;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete value[key];
      continue;
    }
    scrub(value[key], depth + 1);
  }
}

export function mongoSanitize(req, _res, next) {
  scrub(req.body);
  scrub(req.query);
  scrub(req.params);
  next();
}
