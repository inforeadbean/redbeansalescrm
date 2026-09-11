import { asyncHandler } from "../utils/asyncHandler.js";
import ConversionType from "../models/ConversionType.js";

// The two RBH has always booked — self-healing (upserted on every list call)
// so a fresh DB, or one where these got deleted, always has them.
const BUILT_IN = [
  { name: "IFO", code: "ifo", defaultValue: 200000 },
  { name: "RBC", code: "rbc", defaultValue: 500000 },
];

async function ensureDefaults() {
  await Promise.all(
    BUILT_IN.map((d) => ConversionType.updateOne({ code: d.code }, { $setOnInsert: d }, { upsert: true }))
  );
}

// name -> a stable storage code: lowercase, letters/digits/underscore only.
const slugify = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

// @route GET /api/conversion-types
export const listConversionTypes = asyncHandler(async (req, res) => {
  await ensureDefaults();
  const rows = await ConversionType.find().sort("name").lean();
  res.json(rows);
});

// @route POST /api/conversion-types   { name, defaultValue? }
// Open to any signed-in role — admin, manager or salesperson — so recording
// the first sale of a new business line doesn't need an admin in the loop.
export const createConversionType = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    res.status(400);
    throw new Error("A name is required.");
  }
  const code = slugify(name);
  if (!code) {
    res.status(400);
    throw new Error("That name needs at least one letter or number.");
  }
  const existing = await ConversionType.findOne({ code });
  if (existing) {
    res.status(409);
    throw new Error(`"${existing.name}" already exists.`);
  }
  const defaultValue = Math.max(0, Number(req.body.defaultValue) || 0);
  const type = await ConversionType.create({ name, code, defaultValue, createdBy: req.user._id });
  res.status(201).json(type);
});
