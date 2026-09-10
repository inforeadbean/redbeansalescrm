// Shared list-endpoint helper. Reads ?page (1-indexed, default 1) and ?limit
// (default 20, hard-capped at 100) off the query string and returns the exact
// shape every list route responds with:
//   { data: [...], total, page, pages }
// so the frontend's <Pagination> and <DataTable> can stay generic.
export async function paginate(model, filter = {}, opts = {}) {
  const { query = {}, sort = "-createdAt", populate, select } = opts;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  let q = model
    .find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (select) q = q.select(select);
  if (populate) q = q.populate(populate);

  const [data, total] = await Promise.all([
    q.lean(),
    model.countDocuments(filter),
  ]);

  return { data, total, page, pages: Math.ceil(total / limit) || 1 };
}
