import { asyncHandler } from "../utils/asyncHandler.js";
import { scopedLeadIds } from "../utils/scopedLeadIds.js";
import Webinar from "../models/Webinar.js";
import Remark from "../models/Remark.js";

// Webinars are company-wide (not role-scoped) — every user sees the same list.
// Only admin/manager create/edit them; anyone can manage registrations for
// leads they can see.

const listView = (w) => ({
  _id: w._id,
  title: w.title,
  description: w.description,
  scheduledAt: w.scheduledAt,
  status: w.status,
  host: w.host,
  registrationCount: w.registrations.length,
  attendedCount: w.registrations.filter((r) => r.attended).length,
  createdAt: w.createdAt,
});

// @route GET /api/webinars
export const listWebinars = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const webinars = await Webinar.find(filter)
    .sort("-scheduledAt")
    .populate("host", "name")
    .lean();
  res.json(webinars.map(listView));
});

// @route GET /api/webinars/:id — full doc with registrations populated
export const getWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id)
    .populate("host", "name")
    .populate({ path: "registrations.lead", select: "name phone restaurantName city status assignedTo", populate: { path: "assignedTo", select: "name" } })
    .lean();
  if (!webinar) {
    res.status(404);
    throw new Error("Zoom meeting not found.");
  }
  res.json(webinar);
});

// @route POST /api/webinars   (admin, manager)
export const createWebinar = asyncHandler(async (req, res) => {
  const { title, scheduledAt } = req.body;
  if (!title || !scheduledAt) {
    res.status(400);
    throw new Error("title and scheduledAt are required.");
  }
  const webinar = await Webinar.create({
    title,
    description: req.body.description,
    scheduledAt,
    host: req.body.host || req.user._id,
    status: req.body.status || "upcoming",
  });
  res.status(201).json(webinar);
});

// @route PUT /api/webinars/:id   (admin, manager)
export const updateWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);
  if (!webinar) {
    res.status(404);
    throw new Error("Zoom meeting not found.");
  }
  for (const k of ["title", "description", "scheduledAt", "host", "status"])
    if (req.body[k] !== undefined) webinar[k] = req.body[k];
  await webinar.save();
  res.json(webinar);
});

// @route DELETE /api/webinars/:id   (admin, manager)
export const deleteWebinar = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findByIdAndDelete(req.params.id);
  if (!webinar) {
    res.status(404);
    throw new Error("Zoom meeting not found.");
  }
  res.json({ message: "Zoom meeting deleted." });
});

// @route POST /api/webinars/:id/registrations   { leadIds: [] }
export const addRegistrations = asyncHandler(async (req, res) => {
  const raw = Array.isArray(req.body.leadIds) ? req.body.leadIds : [req.body.leadId].filter(Boolean);
  if (!raw.length) {
    res.status(400);
    throw new Error("leadIds is required.");
  }
  const webinar = await Webinar.findById(req.params.id);
  if (!webinar) {
    res.status(404);
    throw new Error("Zoom meeting not found.");
  }

  // Only leads that exist and are in the caller's scope.
  const leadIds = await scopedLeadIds(req.user, raw);
  if (!leadIds.length) {
    res.status(400);
    throw new Error("None of those leads are yours to register.");
  }

  const existing = new Set(webinar.registrations.map((r) => String(r.lead)));
  const fresh = leadIds.filter((id) => !existing.has(String(id)));
  webinar.registrations.push(...fresh.map((lead) => ({ lead })));
  await webinar.save();

  // Just drop a line on each lead's timeline — the salesperson sets the lead's
  // status by hand (e.g. "Interested for Zoom 1"), registering doesn't move it.
  await Remark.insertMany(
    fresh.map((lead) => ({
      lead,
      author: req.user._id,
      type: "note",
      text: `Registered for Zoom meeting: ${webinar.title}`,
    }))
  );

  res.status(201).json({ added: fresh.length, registrationCount: webinar.registrations.length });
});

// @route PATCH /api/webinars/:id/registrations/:regId   { attended }
export const setAttendance = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);
  if (!webinar) {
    res.status(404);
    throw new Error("Zoom meeting not found.");
  }
  const reg = webinar.registrations.id(req.params.regId);
  if (!reg) {
    res.status(404);
    throw new Error("Registration not found.");
  }
  reg.attended = !!req.body.attended;
  await webinar.save();
  res.json({ _id: reg._id, attended: reg.attended });
});

// @route DELETE /api/webinars/:id/registrations/:regId
export const removeRegistration = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);
  if (!webinar) {
    res.status(404);
    throw new Error("Zoom meeting not found.");
  }
  webinar.registrations.pull({ _id: req.params.regId });
  await webinar.save();
  res.json({ message: "Registration removed." });
});
