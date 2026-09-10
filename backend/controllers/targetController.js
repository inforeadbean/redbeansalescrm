import { asyncHandler } from "../utils/asyncHandler.js";
import { scopedSalespeople, teamIds, resolveScopedPerson } from "../utils/scope.js";
import Target from "../models/Target.js";
import User from "../models/User.js";

const thisMonth = () => new Date().getMonth() + 1;
const thisYear = () => new Date().getFullYear();

// A manager may only set targets for their own reports.
async function assertOwnsSalesperson(actor, salespersonId) {
  if (actor.role === "admin") return;
  const ids = (await teamIds(actor)).map(String);
  if (!ids.includes(String(salespersonId))) {
    const err = new Error("You can only set targets for your own team.");
    err.status = 403;
    throw err;
  }
}

// @route GET /api/targets?month&year&salesperson
export const listTargets = asyncHandler(async (req, res) => {
  const month = parseInt(req.query.month, 10) || thisMonth();
  const year = parseInt(req.query.year, 10) || thisYear();

  const ids = await scopedSalespeople(req.user);
  const filter = { month, year, salesperson: { $in: ids } };
  // A `?salesperson=` narrows the grid, but only to someone already in scope —
  // resolveScopedPerson 403s on anyone else rather than leaking their targets.
  const only = await resolveScopedPerson(req.user, req.query.salesperson);
  if (only) filter.salesperson = only;

  const [targets, people] = await Promise.all([
    Target.find(filter).populate("salesperson", "name").populate("setBy", "name").lean(),
    User.find({ _id: { $in: ids }, role: "salesperson" }).select("name").sort("name").lean(),
  ]);

  // Return a row per salesperson so the UI grid always has every person,
  // with an empty (zeroed) target where none has been set yet.
  const byPerson = Object.fromEntries(targets.map((t) => [String(t.salesperson._id), t]));
  const rows = people.map((p) => {
    const t = byPerson[String(p._id)];
    return (
      t || {
        _id: null,
        salesperson: p,
        month,
        year,
        leadTarget: 0,
        callTarget: 0,
        conversionTarget: 0,
        revenueTarget: 0,
      }
    );
  });

  res.json({ month, year, rows });
});

// @route GET /api/targets/me?month&year — the caller's own target
export const getMyTarget = asyncHandler(async (req, res) => {
  const month = parseInt(req.query.month, 10) || thisMonth();
  const year = parseInt(req.query.year, 10) || thisYear();
  const target = await Target.findOne({ salesperson: req.user._id, month, year }).lean();
  res.json(target || { salesperson: req.user._id, month, year, leadTarget: 0, callTarget: 0, conversionTarget: 0, revenueTarget: 0 });
});

// @route POST /api/targets — create or overwrite (salesperson, month, year)
// @access admin, manager
export const upsertTarget = asyncHandler(async (req, res) => {
  const { salesperson, month, year } = req.body;
  if (!salesperson || !month || !year) {
    res.status(400);
    throw new Error("salesperson, month and year are required.");
  }
  await assertOwnsSalesperson(req.user, salesperson);

  const fields = ["leadTarget", "callTarget", "conversionTarget", "revenueTarget"];
  const update = { setBy: req.user._id };
  for (const f of fields) update[f] = Math.max(0, Number(req.body[f]) || 0);

  const target = await Target.findOneAndUpdate(
    { salesperson, month, year },
    { $set: update, $setOnInsert: { salesperson, month, year } },
    { new: true, upsert: true }
  ).populate("salesperson", "name");

  res.status(201).json(target);
});

// @route PUT /api/targets/:id
// @access admin, manager
export const updateTarget = asyncHandler(async (req, res) => {
  const target = await Target.findById(req.params.id);
  if (!target) {
    res.status(404);
    throw new Error("Target not found.");
  }
  await assertOwnsSalesperson(req.user, target.salesperson);
  for (const f of ["leadTarget", "callTarget", "conversionTarget", "revenueTarget"])
    if (req.body[f] !== undefined) target[f] = Math.max(0, Number(req.body[f]) || 0);
  target.setBy = req.user._id;
  await target.save();
  res.json(await target.populate("salesperson", "name"));
});

// @route DELETE /api/targets/:id
// @access admin, manager
export const deleteTarget = asyncHandler(async (req, res) => {
  const target = await Target.findById(req.params.id);
  if (!target) {
    res.status(404);
    throw new Error("Target not found.");
  }
  await assertOwnsSalesperson(req.user, target.salesperson);
  await target.deleteOne();
  res.json({ message: "Target cleared." });
});
