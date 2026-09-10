import { asyncHandler } from "../utils/asyncHandler.js";
import { paginate } from "../utils/paginate.js";
import { leadScope } from "../utils/scope.js";
import { syncFollowUpReminder } from "../utils/followupReminder.js";
import { dateRangeFilter } from "../utils/dateRange.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { phoneDigits, isTenDigits } from "../utils/phone.js";
import { inr } from "../utils/money.js";
import { moveBlocked } from "../utils/stageFlow.js";
import Lead, { LEAD_STATUSES, LEAD_SOURCES, LEAD_CLOSED } from "../models/Lead.js";
import Remark from "../models/Remark.js";
import Reminder from "../models/Reminder.js";
import IfoConversion from "../models/IfoConversion.js";
import EventBooking from "../models/EventBooking.js";
import Webinar from "../models/Webinar.js";
import { LEAD_STATUS_LABELS } from "../utils/labels.js";

// For any converted leads in the list, pull the real numbers off their
// conversion record — `dealValue` (confirmed, not the estimate) and
// `amountReceived` — so the UI can show confirmed money in green. Mutates the
// lean lead docs in place.
async function attachDealValues(leads) {
  const ids = leads.filter((l) => l.status === "converted").map((l) => l._id);
  if (!ids.length) return leads;
  const convs = await IfoConversion.find({ lead: { $in: ids } })
    .select("lead dealValue amountReceived conversionType")
    .lean();
  const byLead = Object.fromEntries(convs.map((c) => [String(c.lead), c]));
  for (const l of leads) {
    const c = byLead[String(l._id)];
    if (c) {
      l.conversionId = c._id;
      l.dealValue = c.dealValue;
      l.amountReceived = c.amountReceived;
      l.conversionType = c.conversionType;
    }
  }
  return leads;
}

// Turns ?status/?source/?assignedTo/?q/?from/?to into a Mongo filter. Kept
// separate from the role scope so the two can be AND-ed — a salesperson
// passing ?assignedTo=<someoneElse> still can't widen what they see.
// A query-string value is only usable if it's a real string — `?status[x]=y`
// arrives as an object, and spreading that into a Mongo filter is an injection
// foot-gun even after the `$`/`.` sanitizer. Anything non-string is ignored.
const str = (v) => (typeof v === "string" ? v : "");

function queryFilter(q) {
  const f = {};
  if (str(q.status)) f.status = str(q.status);
  if (str(q.source)) f.source = str(q.source);
  if (str(q.assignedTo)) f.assignedTo = str(q.assignedTo);
  if (str(q.q)) {
    const rx = new RegExp(escapeRegex(str(q.q).trim()), "i");
    f.$or = [{ name: rx }, { phone: rx }, { restaurantName: rx }, { email: rx }, { city: rx }];
  }
  Object.assign(f, dateRangeFilter("createdAt", q.from, q.to));
  // Drill-down helpers used by the dashboard's clickable tiles.
  // ?open=1        — anything still in the active pipeline
  // ?followup=due  — open leads whose next follow-up is today or overdue
  if ((q.open === "1" || q.followup === "due") && !q.status) {
    f.status = { $nin: LEAD_CLOSED };
  }
  if (q.followup === "due") f.nextFollowUpDate = { $lte: new Date() };
  return f;
}

async function scopedFilter(req) {
  return { $and: [await leadScope(req.user), queryFilter(req.query)] };
}

// Load a lead the caller is allowed to see, or throw 404.
async function findScoped(req, res) {
  const lead = await Lead.findOne({ _id: req.params.id, ...(await leadScope(req.user)) });
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found.");
  }
  return lead;
}

async function logRemark(leadId, author, text, type = "note") {
  return Remark.create({ lead: leadId, author, text, type });
}

// An existing lead (any owner) with this phone — the CRM keeps one row per
// number, so the "New lead" form / edit rejects a duplicate. Matches on the
// normalised 10-digit number; `excludeId` skips the lead being edited.
async function findLeadByPhone(phone, excludeId) {
  const digits = phoneDigits(phone);
  if (digits.length !== 10) return null;
  const q = { phone: digits };
  if (excludeId) q._id = { $ne: excludeId };
  return Lead.findOne(q).populate("assignedTo", "name").lean();
}

const dupePhoneMessage = (dup) =>
  `This number is already in the CRM — "${dup.name}"${
    dup.assignedTo?.name ? `, owned by ${dup.assignedTo.name}` : ""
  }. Open that lead instead of adding it again.`;

// @route GET /api/leads   (?view=kanban groups by status instead of paging)
export const listLeads = asyncHandler(async (req, res) => {
  const filter = await scopedFilter(req);

  if (req.query.view === "kanban") {
    const perColumn = 60;
    // `_id` breaks ties so skip-based column paging is exact even when a whole
    // batch of leads shares an `updatedAt` (e.g. a bulk import).
    const KANBAN_SORT = "-updatedAt -_id";

    // Paging a single column as it auto-fills on the board:
    //   ?view=kanban&col=<status>&skip=<n>[&limit=<n>]  → { column, items, total }
    if (str(req.query.col)) {
      const status = str(req.query.col);
      const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
      const limit = Math.min(400, Math.max(1, parseInt(req.query.limit, 10) || 120));
      const colFilter = { $and: [filter, { status }] };
      const [items, total] = await Promise.all([
        Lead.find(colFilter)
          .sort(KANBAN_SORT)
          .skip(skip)
          .limit(limit)
          .populate("assignedTo", "name")
          .lean(),
        Lead.countDocuments(colFilter),
      ]);
      if (status === "converted") await attachDealValues(items);
      return res.json({ view: "kanban", column: status, items, total });
    }

    const columns = {};
    await Promise.all(
      LEAD_STATUSES.map(async (status) => {
        const colFilter = { $and: [filter, { status }] };
        const [items, total] = await Promise.all([
          Lead.find(colFilter)
            .sort(KANBAN_SORT)
            .limit(perColumn)
            .populate("assignedTo", "name")
            .lean(),
          Lead.countDocuments(colFilter),
        ]);
        columns[status] = { items, total };
      })
    );
    if (columns.converted) await attachDealValues(columns.converted.items);
    return res.json({ view: "kanban", columns });
  }

  const result = await paginate(Lead, filter, {
    query: req.query,
    sort: req.query.sort || "-createdAt",
    populate: { path: "assignedTo", select: "name" },
  });
  await attachDealValues(result.data);
  res.json(result);
});

// @route GET /api/leads/meta/pipeline  — counts + value per status, in scope
export const pipelineMeta = asyncHandler(async (req, res) => {
  const filter = await scopedFilter(req);
  const rows = await Lead.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        value: { $sum: "$potentialValue" },
      },
    },
  ]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, { count: r.count, value: r.value }]));
  res.json(
    LEAD_STATUSES.map((status) => ({
      status,
      count: byStatus[status]?.count || 0,
      value: byStatus[status]?.value || 0,
    }))
  );
});

// @route GET /api/leads/:id  — lead + its timeline (most recent 100 remarks)
export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...(await leadScope(req.user)) })
    .populate("assignedTo", "name email")
    .populate("createdBy", "name");
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found.");
  }
  const remarks = await Remark.find({ lead: lead._id })
    .sort("-createdAt")
    .limit(100)
    .populate("author", "name")
    .lean();

  const out = lead.toObject();

  // Every webinar this lead is on — title, date, and whether they attended.
  // Powers the "needed a second Zoom" flow on the lead page: a lead can be
  // walked through extra webinars here without their pipeline stage moving.
  const webinarDocs = await Webinar.find({ "registrations.lead": lead._id })
    .select("title scheduledAt status registrations")
    .sort("scheduledAt")
    .lean();
  out.webinars = webinarDocs.map((w) => {
    const reg = w.registrations.find((r) => String(r.lead) === String(lead._id));
    return {
      webinarId: w._id,
      title: w.title,
      scheduledAt: w.scheduledAt,
      status: w.status,
      regId: reg?._id,
      attended: !!reg?.attended,
      registeredAt: reg?.registeredAt,
    };
  });

  if (out.status === "converted") {
    const conv = await IfoConversion.findOne({ lead: lead._id })
      .select("dealValue amountReceived conversionType nextInstallmentDate nextInstallmentAmount nextInstallmentNote")
      .lean();
    if (conv) {
      out.conversionId = conv._id;
      out.dealValue = conv.dealValue;
      out.amountReceived = conv.amountReceived;
      out.conversionType = conv.conversionType;
      out.nextInstallmentDate = conv.nextInstallmentDate || null;
      out.nextInstallmentAmount = conv.nextInstallmentAmount || null;
      out.nextInstallmentNote = conv.nextInstallmentNote || null;
    }
  }

  const booking = await EventBooking.findOne({ lead: lead._id }).sort("-createdAt").lean();
  if (booking) out.seatBooking = { amount: booking.amount, at: booking.createdAt };

  res.json({ lead: out, remarks });
});

// @route POST /api/leads
export const createLead = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    res.status(400);
    throw new Error("Name and phone are required.");
  }
  if (!isTenDigits(phone)) {
    res.status(400);
    throw new Error("Phone number must be exactly 10 digits.");
  }

  const dup = await findLeadByPhone(phone);
  if (dup) {
    res.status(409);
    throw new Error(dupePhoneMessage(dup));
  }

  // A salesperson can only ever create leads owned by themselves.
  let assignedTo = req.body.assignedTo || req.user._id;
  if (req.user.role === "salesperson") assignedTo = req.user._id;

  // A lead can be captured straight from a webinar — if so it's registered for
  // that webinar. An explicit, valid `source` still wins (the lead may have
  // come from Social / a referral and just been added to an upcoming Zoom);
  // otherwise a linked webinar implies source "webinar".
  const webinar = req.body.webinar ? await Webinar.findById(req.body.webinar) : null;
  const source = LEAD_SOURCES.includes(req.body.source)
    ? req.body.source
    : webinar
    ? "webinar"
    : "other";

  const lead = await Lead.create({
    name,
    phone: phoneDigits(phone),
    email: req.body.email,
    restaurantName: req.body.restaurantName,
    city: req.body.city,
    state: req.body.state,
    source,
    status: "new",
    assignedTo,
    createdBy: req.user._id,
    nextFollowUpDate: req.body.nextFollowUpDate || undefined,
    potentialValue: req.body.potentialValue || 0,
  });

  await logRemark(lead._id, req.user._id, "Lead created.", "system");
  await syncFollowUpReminder(lead, req.user._id);

  if (webinar) {
    webinar.registrations.push({ lead: lead._id });
    await webinar.save();
    await logRemark(lead._id, req.user._id, `Came in from Zoom meeting: ${webinar.title}`, "system");
  }

  res.status(201).json(await lead.populate("assignedTo", "name"));
});

// Last 10 digits — so "+91 98765 43210", "098765-43210" and "9876543210" all
// match for duplicate detection.
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-10);

// An optional per-row "created on" from the import file (the frontend sends an
// ISO string). Reject anything unparseable, far-future, or pre-2000 → the lead
// just gets today's date instead.
function importDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now() + 86400000) return null;
  if (d.getFullYear() < 2000) return null;
  return d;
}

// @route POST /api/leads/bulk   { leads: [{name?, phone, location?, remarks?, createdAt?}], assignedTo? }
// CSV / Excel import. Phone is the only required field; `location` lands in
// `city` and `remarks` becomes the first note on the timeline. `createdAt`
// backdates the lead (and its first stage-history entry) so migrated data keeps
// its real age. Rows with no phone, or a phone that already exists for this
// owner (or repeats within the file), are skipped and reported back — the
// import never half-fails.
export const bulkCreateLeads = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.leads) ? req.body.leads : [];
  if (!rows.length) {
    res.status(400);
    throw new Error("Nothing to import — the file had no rows.");
  }
  if (rows.length > 2000) {
    res.status(400);
    throw new Error("Import up to 2000 leads at a time.");
  }

  let assignedTo = req.body.assignedTo || req.user._id;
  if (req.user.role === "salesperson") assignedTo = req.user._id;

  // De-dupe company-wide (not just this owner) so a migrated list can't create a
  // second copy of a lead another salesperson already holds. `known` maps the
  // normalised phone → the existing lead's name for a clear skip reason.
  const existing = await Lead.find({}).select("phone name").lean();
  const known = new Map();
  for (const l of existing) {
    const k = phoneKey(l.phone);
    if (k && !known.has(k)) known.set(k, l.name);
  }
  const seenInFile = new Set();

  const skipped = [];
  let created = 0;

  // Clamp to the model's field limits so one oversized cell can't fail a whole
  // chunk on a validation error.
  const cap = (s, n) => (s.length > n ? s.slice(0, n) : s);

  for (let i = 0; i < rows.length; i++) {
    const phone = cap(String(rows[i]?.phone ?? "").trim(), 40);
    const name = cap(String(rows[i]?.name ?? "").trim(), 200);
    const location = cap(String(rows[i]?.location ?? "").trim(), 120);
    const remark = cap(String(rows[i]?.remarks ?? "").trim(), 5000);
    const when = importDate(rows[i]?.createdAt);

    if (!phone) {
      skipped.push({ row: i + 1, name, reason: "No phone number", type: "no_phone" });
      continue;
    }
    if (!isTenDigits(phone)) {
      skipped.push({ row: i + 1, name, reason: "Phone isn't a 10-digit number", type: "bad_phone" });
      continue;
    }
    const digits = phoneDigits(phone);
    const key = phoneKey(phone);
    if (key) {
      if (known.has(key)) {
        const asName = known.get(key);
        skipped.push({
          row: i + 1,
          name,
          reason: asName ? `Already in CRM as "${asName}"` : "Already in CRM",
          type: "duplicate",
        });
        continue;
      }
      if (seenInFile.has(key)) {
        skipped.push({ row: i + 1, name, reason: "Repeated earlier in this file", type: "duplicate" });
        continue;
      }
      seenInFile.add(key);
    }

    const lead = await Lead.create({
      name: name || digits,
      phone: digits,
      city: location,
      source: "other",
      status: "new",
      assignedTo,
      createdBy: req.user._id,
      // Mongoose keeps an explicitly-set createdAt; the pre-save hook seeds
      // statusHistory[0].at from statusChangedAt, so set both.
      ...(when ? { createdAt: when, statusChangedAt: when } : {}),
    });
    await Remark.create({
      lead: lead._id,
      author: req.user._id,
      type: "system",
      text: "Lead created — bulk import.",
      ...(when ? { createdAt: when } : {}),
    });
    if (remark) {
      await Remark.create({
        lead: lead._id,
        author: req.user._id,
        type: "note",
        text: remark,
        ...(when ? { createdAt: when } : {}),
      });
    }
    created += 1;
  }

  res.status(201).json({ created, skippedCount: skipped.length, skipped: skipped.slice(0, 100) });
});

// @route PUT /api/leads/:id  — edit contact fields (not status; not owner)
export const updateLead = asyncHandler(async (req, res) => {
  const lead = await findScoped(req, res);
  const editable = [
    "name",
    "phone",
    "email",
    "restaurantName",
    "city",
    "state",
    "source",
    "nextFollowUpDate",
    "potentialValue",
  ];
  if (req.body.phone !== undefined && !isTenDigits(req.body.phone)) {
    res.status(400);
    throw new Error("Phone number must be exactly 10 digits.");
  }
  if (req.body.phone !== undefined && phoneDigits(req.body.phone) !== lead.phone) {
    const dup = await findLeadByPhone(req.body.phone, lead._id);
    if (dup) {
      res.status(409);
      throw new Error(dupePhoneMessage(dup));
    }
  }
  for (const key of editable) if (req.body[key] !== undefined) lead[key] = req.body[key];
  if (req.body.phone !== undefined) lead.phone = phoneDigits(req.body.phone);
  await lead.save();
  if (req.body.nextFollowUpDate !== undefined) await syncFollowUpReminder(lead, req.user._id);
  res.json(await lead.populate("assignedTo", "name"));
});

// @route PATCH /api/leads/:id/status
//   { status, note?, lostReason?, nextFollowUpDate?, seatBookingAmount?, eventId? }
// The status stepper (detail page) and the Kanban both come through here and
// both prompt for an optional remark — so every stage change leaves a trail of
// what changed and why. Moving to "event_interested" can also carry a seat
// booking fee.
export const updateLeadStatus = asyncHandler(async (req, res) => {
  const { status, note, lostReason, nextFollowUpDate, seatBookingAmount, eventId } = req.body;
  if (!LEAD_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`status must be one of: ${LEAD_STATUSES.join(", ")}`);
  }
  const lead = await findScoped(req, res);
  const from = lead.status;

  const trimmedNote = note?.trim();
  if (from === status && !trimmedNote && nextFollowUpDate === undefined) return res.json(lead);

  // Leads move forward-only, for every role — no walking back down the funnel,
  // no pulling a lead out of "Converted", no reopening a "Dead"/"Invalid" one.
  // (To undo a sale a manager deletes the conversion record; a lead that comes
  // back is re-added.) Follow-up is the "stalled" bay — moving to it, or a
  // Follow-up lead anywhere, is always fine.
  if (from !== status) {
    const blocked = moveBlocked(from, status, lead.statusHistory);
    if (blocked) {
      res.status(403);
      throw new Error(blocked);
    }
  }

  // Moving a lead OUT of "Converted" un-does the sale: its IfoConversion (deal
  // value, payment log) and instalment reminder are removed so revenue, client
  // counts and the 5-for-3 report everywhere stop counting this lead. The
  // frontend confirms this with the user first. A timeline line records it.
  let removedConversion = null;
  if (from === "converted" && status !== "converted") {
    removedConversion = await IfoConversion.findOne({ lead: lead._id }).lean();
    if (removedConversion) {
      await IfoConversion.deleteMany({ lead: lead._id });
      await Reminder.deleteMany({ lead: lead._id, kind: "installment" });
    }
  }

  lead.status = status;
  if ((status === "dead" || status === "invalid") && lostReason) lead.lostReason = lostReason;
  if (nextFollowUpDate !== undefined) lead.nextFollowUpDate = nextFollowUpDate || undefined;
  // This move can be undone once (until the next move) — see undoLeadStatus.
  if (from !== status) lead.statusRevertable = true;
  await lead.save();
  if (nextFollowUpDate !== undefined) await syncFollowUpReminder(lead, req.user._id);

  // Seat booking fee, collected when a lead crosses into "Interested for event"
  // (once per lead — a re-transition doesn't re-charge).
  let seatBooked = 0;
  const amt = Number(seatBookingAmount);
  if (status === "event_interested" && from !== "event_interested" && amt > 0) {
    if (!(await EventBooking.exists({ lead: lead._id }))) {
      await EventBooking.create({
        lead: lead._id,
        event: eventId || undefined,
        amount: amt,
        collectedBy: req.user._id,
      });
      await logRemark(lead._id, req.user._id, `Event seat booking collected: ${inr(amt)}.`, "payment");
      seatBooked = amt;
    }
  }

  if (removedConversion) {
    await logRemark(
      lead._id,
      req.user._id,
      `Conversion removed — lead moved out of Converted (was a ${inr(removedConversion.dealValue)} deal, ${inr(
        removedConversion.amountReceived
      )} collected). No longer counts toward revenue or clients.`,
      "system"
    );
  }

  const label = (s) => LEAD_STATUS_LABELS[s] || s;
  const followLabel = nextFollowUpDate
    ? new Date(nextFollowUpDate).toLocaleDateString("en-IN")
    : null;
  const followNote = followLabel ? ` · follow-up ${followLabel}` : "";

  // Only leave a timeline entry when there's something to record — a bare
  // follow-up date change with no status move and no note still gets a line,
  // but an empty one is skipped rather than failing the request.
  let text;
  if (from !== status) {
    text = `Status changed: ${label(from)} → ${label(status)}${
      trimmedNote ? ` — ${trimmedNote}` : ""
    }${followNote}`;
  } else if (trimmedNote) {
    text = `${trimmedNote}${followNote}`;
  } else if (followLabel) {
    text = `Follow-up set for ${followLabel}`;
  }
  if (text) await logRemark(lead._id, req.user._id, text, "status_change");

  res.json(await lead.populate("assignedTo", "name"));
});

// @route POST /api/leads/:id/undo-status
// One-step "oops" for the last stage move — a lead dragged / clicked to the
// wrong stage goes straight back. Available (for anyone who can see the lead)
// only while `statusRevertable` is set, i.e. right after a move and until the
// next one — so it never chains into a free backward-walk. The mistaken
// `statusHistory` entry is dropped so the funnel / 5-for-3 reports don't credit
// a stage the lead never really reached.
export const undoLeadStatus = asyncHandler(async (req, res) => {
  const lead = await findScoped(req, res);
  const hist = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
  if (!lead.statusRevertable || hist.length < 2) {
    res.status(400);
    throw new Error("There's no recent stage change to undo.");
  }

  const mistaken = hist[hist.length - 1].status; // === lead.status
  const mistakenAt = hist[hist.length - 1].at;
  const prev = hist[hist.length - 2];

  // Bypass the pre('save') status hook — we're rewriting history, not adding to
  // it — with a direct update.
  await Lead.updateOne(
    { _id: lead._id },
    {
      $set: {
        status: prev.status,
        statusChangedAt: prev.at,
        statusHistory: hist.slice(0, -1),
        statusRevertable: false,
      },
    }
  );

  // If the move being undone was into "Interested for event", the seat-booking
  // fee taken as part of it is void too — drop it so the dashboard and the lead
  // stop showing money that was never really collected. (A lead only ever has
  // one booking, created when it first crosses into that stage.)
  let removedBooking = 0;
  if (mistaken === "event_interested") {
    const booking = await EventBooking.findOne({
      lead: lead._id,
      createdAt: { $gte: new Date(new Date(mistakenAt).getTime() - 5000) },
    });
    if (booking) {
      removedBooking = booking.amount;
      await booking.deleteOne();
    }
  }

  const label = (s) => LEAD_STATUS_LABELS[s] || s;
  await logRemark(
    lead._id,
    req.user._id,
    `Stage change undone — "${label(mistaken)}" was a mistake, back at "${label(prev.status)}".` +
      (removedBooking ? ` Seat booking of ${inr(removedBooking)} cancelled.` : ""),
    "status_change"
  );

  res.json(await Lead.findById(lead._id).populate("assignedTo", "name"));
});

// @route PATCH /api/leads/:id/assign   { assignedTo }   (admin, manager)
export const assignLead = asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;
  if (!assignedTo) {
    res.status(400);
    throw new Error("assignedTo is required.");
  }
  const lead = await findScoped(req, res);
  lead.assignedTo = assignedTo;
  await lead.save();
  await lead.populate("assignedTo", "name");
  await logRemark(lead._id, req.user._id, `Lead reassigned to ${lead.assignedTo?.name}.`, "system");
  res.json(lead);
});

// @route DELETE /api/leads/:id   (admin, manager)
export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await findScoped(req, res);
  // Take its timeline, reminders and any conversion record with it — an
  // orphaned IfoConversion would keep counting toward revenue and client
  // totals, and orphaned reminders would fire pointing at a dead lead.
  await Promise.all([
    Remark.deleteMany({ lead: lead._id }),
    Reminder.deleteMany({ lead: lead._id }),
    IfoConversion.deleteMany({ lead: lead._id }),
    EventBooking.deleteMany({ lead: lead._id }),
  ]);
  await lead.deleteOne();
  res.json({ message: "Lead deleted." });
});

// @route GET /api/leads/:id/remarks   (paged)
export const listRemarks = asyncHandler(async (req, res) => {
  await findScoped(req, res); // authorization check
  const result = await paginate(
    Remark,
    { lead: req.params.id },
    { query: req.query, sort: "-createdAt", populate: { path: "author", select: "name" } }
  );
  res.json(result);
});

// @route POST /api/leads/:id/remarks   { text }
export const addRemark = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) {
    res.status(400);
    throw new Error("Remark text is required.");
  }
  await findScoped(req, res);
  const remark = await logRemark(req.params.id, req.user._id, text.trim(), "note");
  res.status(201).json(await remark.populate("author", "name"));
});
