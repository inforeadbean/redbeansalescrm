// Escape every regex metacharacter in a user-supplied search string so it can
// be dropped into `new RegExp(...)` for a literal "contains" match. Without this
// a query like "C++" or "a.b" matches the wrong rows, and a crafted pattern
// like "(a+)+$" can pin a CPU (ReDoS). Every place that builds a RegExp from
// request input must go through here.
export const escapeRegex = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
