import { asyncHandler } from "../utils/asyncHandler.js";
import { scopedLeadIds, canActOnLead } from "../utils/scopedLeadIds.js";
import Event, { RSVP_STATUSES } from "../models/Event.js";
import Remark from "../models/Remark.js";
import Lead from "../models/Lead.js";
import { LEAD_STATUS_LABELS } from "../utils/labels.js";

// Physical events. Same company-wide visibility model as webinars; the
// attendee list is `invitees` and carries an RSVP state on top of `attended`.

// A lead sitting at any of these stages, once ticked "attended" for an event,
// is auto-advanced to "event_attended" — same rule Zoom attendance uses. A
// lead already past this point (course_interested, converted) or already at
// event_attended is left exactly where it is.
const ADVANCE_ON_EVENT = ["new", "webinar_interested", "webinar_attended", "event_interested"];

// An event left "upcoming" past its own date is just stale data. Lazily
// correct it whenever the list/detail is read.
async function flipPastUpcoming() {
  await Event.updateMany(
    { status: "upcoming", date: { $lt: new Date() } },
    { $set: { status: "completed" } }
  );
}

const listView = (e) => ({
  _id: e._id,
  title: e.title,
  description: e.description,
  venue: e.venue,
  city: e.city,
  date: e.date,
  status: e.status,
  host: e.host,
  inviteeCount: e.invitees.length,
  confirmedCount: e.invitees.filter((i) => i.rsvp === "confirmed").length,
  attendedCount: e.invitees.filter((i) => i.attended).length,
  createdAt: e.createdAt,
});

// @route GET /api/events
export const listEvents = asyncHandler(async (req, res) => {
  await flipPastUpcoming();
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const events = await Event.find(filter).sort("-date").populate("host", "name").lean();
  res.json(events.map(listView));
});

// @route GET /api/events/:id
export const getEvent = asyncHandler(async (req, res) => {
  await flipPastUpcoming();
  const event = await Event.findById(req.params.id)
    .populate("host", "name")
    .populate({ path: "invitees.lead", select: "name phone restaurantName city status assignedTo", populate: { path: "assignedTo", select: "name" } })
    .lean();
  if (!event) {
    res.status(404);
    throw new Error("Event not found.");
  }
  res.json(event);
});

// @route POST /api/events   (admin, manager)
export const createEvent = asyncHandler(async (req, res) => {
  const { title, date } = req.body;
  if (!title || !date) {
    res.status(400);
    throw new Error("title and date are required.");
  }
  const event = await Event.create({
    title,
    description: req.body.description,
    venue: req.body.venue,
    city: req.body.city,
    date,
    host: req.body.host || req.user._id,
    status: req.body.status || "upcoming",
  });
  res.status(201).json(event);
});

// @route PUT /api/events/:id   (admin, manager)
export const updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error("Event not found.");
  }
  for (const k of ["title", "description", "venue", "city", "date", "host", "status"])
    if (req.body[k] !== undefined) event[k] = req.body[k];
  await event.save();
  res.json(event);
});

// @route DELETE /api/events/:id   (admin, manager)
export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error("Event not found.");
  }
  res.json({ message: "Event deleted." });
});

// @route POST /api/events/:id/invitees   { leadIds: [] }
export const addInvitees = asyncHandler(async (req, res) => {
  const raw = Array.isArray(req.body.leadIds) ? req.body.leadIds : [req.body.leadId].filter(Boolean);
  if (!raw.length) {
    res.status(400);
    throw new Error("leadIds is required.");
  }
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error("Event not found.");
  }

  // Only leads that exist and are in the caller's scope.
  const leadIds = await scopedLeadIds(req.user, raw);
  if (!leadIds.length) {
    res.status(400);
    throw new Error("None of those leads are yours to invite.");
  }
  const existing = new Set(event.invitees.map((i) => String(i.lead)));
  const fresh = leadIds.filter((id) => !existing.has(String(id)));
  event.invitees.push(...fresh.map((lead) => ({ lead })));
  await event.save();

  // Timeline note only — the salesperson moves the lead's status by hand
  // ("Interested for event"), inviting doesn't move it.
  await Remark.insertMany(
    fresh.map((lead) => ({
      lead,
      author: req.user._id,
      type: "note",
      text: `Invited to event: ${event.title}`,
    }))
  );
  res.status(201).json({ added: fresh.length, inviteeCount: event.invitees.length });
});

// @route PATCH /api/events/:id/invitees/:inviteeId   { rsvp?, attended? }
export const setInvitee = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error("Event not found.");
  }
  const invitee = event.invitees.id(req.params.inviteeId);
  if (!invitee) {
    res.status(404);
    throw new Error("Invitee not found.");
  }
  if (!(await canActOnLead(req.user, invitee.lead))) {
    res.status(403);
    throw new Error("You can only update your own leads on an event.");
  }
  if (req.body.rsvp !== undefined) {
    if (!RSVP_STATUSES.includes(req.body.rsvp)) {
      res.status(400);
      throw new Error(`rsvp must be one of: ${RSVP_STATUSES.join(", ")}`);
    }
    invitee.rsvp = req.body.rsvp;
  }
  const wasAttended = invitee.attended;
  if (req.body.attended !== undefined) invitee.attended = !!req.body.attended;
  await event.save();

  // Ticking "attended" moves an early-stage lead straight to "Event attended".
  let advancedTo = null;
  if (invitee.attended && !wasAttended) {
    const lead = await Lead.findById(invitee.lead);
    if (lead && ADVANCE_ON_EVENT.includes(lead.status)) {
      const from = lead.status;
      lead.status = "event_attended";
      lead.statusRevertable = true; // an accidental tick can be undone
      await lead.save(); // pre-save hook stamps statusHistory + statusChangedAt
      await Remark.create({
        lead: lead._id,
        author: req.user._id,
        type: "status_change",
        text: `Status changed: ${LEAD_STATUS_LABELS[from] || from} → ${LEAD_STATUS_LABELS.event_attended} — marked attended for "${event.title}".`,
      });
      advancedTo = lead.status;
    }
  }

  res.json({ _id: invitee._id, rsvp: invitee.rsvp, attended: invitee.attended, leadStatus: advancedTo });
});

// @route DELETE /api/events/:id/invitees/:inviteeId
export const removeInvitee = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error("Event not found.");
  }
  const invitee = event.invitees.id(req.params.inviteeId);
  if (invitee && !(await canActOnLead(req.user, invitee.lead))) {
    res.status(403);
    throw new Error("You can only remove your own leads from an event.");
  }
  const wasAttended = !!invitee?.attended;
  const leadId = invitee?.lead;
  event.invitees.pull({ _id: req.params.inviteeId });
  await event.save();

  // If that was the only event this lead was ever marked attended for, and
  // they're sitting at "Event attended" because of it, walk the stage back.
  if (wasAttended && leadId) {
    const lead = await Lead.findById(leadId);
    if (lead && lead.status === "event_attended") {
      const stillAttended = await Event.exists({
        "invitees.lead": leadId,
        "invitees.attended": true,
      });
      if (!stillAttended) {
        const hist = lead.statusHistory || [];
        const idx = hist.map((h) => h.status).lastIndexOf("event_attended");
        const backTo = idx > 0 ? hist[idx - 1].status : "event_interested";
        lead.status = backTo;
        await lead.save();
        await Remark.create({
          lead: lead._id,
          author: req.user._id,
          type: "system",
          text: `Removed from "${event.title}" — their only recorded event attendance, so the stage moved back to "${LEAD_STATUS_LABELS[backTo] || backTo}".`,
        });
      }
    }
  }

  res.json({ message: "Invitee removed." });
});
