import { asyncHandler } from "../utils/asyncHandler.js";
import { leadScope, activityScope, scopedSalespeople } from "../utils/scope.js";
import Lead, { LEAD_CLOSED } from "../models/Lead.js";
import IfoConversion from "../models/IfoConversion.js";
import Target from "../models/Target.js";
import User from "../models/User.js";
import { LEAD_STATUS_LABELS } from "../utils/labels.js";
import { inr } from "../utils/money.js";

// The "Ask" floating assistant — a Groq-backed chat that can only see data the
// caller could already see through the rest of the app. Every reply is
// grounded in a fresh, role-scoped snapshot built with the exact same
// leadScope/activityScope/scopedSalespeople helpers every other endpoint
// uses, so a salesperson's assistant only ever knows their own leads, a
// manager's only their team's, and admin's the whole company. Nothing here
// widens what a role can already query.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// gpt-oss models reason into a separate hidden field before writing the
// visible answer — reasoning_effort:"low" keeps that budget small so
// max_tokens isn't spent before any real content comes out.
const MODEL = "openai/gpt-oss-120b";
const MAX_HISTORY = 6; // prior turns kept for context — bounds token use / cost
const MAX_MESSAGE_LEN = 1000;

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

async function buildContext(user) {
  const lf = await leadScope(user);
  const iff = await activityScope(user, "convertedBy");
  const now = new Date();
  const mStart = startOfMonth();

  const [statusRows, followUps, monthConv, allConv, target] = await Promise.all([
    Lead.aggregate([{ $match: lf }, { $group: { _id: "$status", c: { $sum: 1 } } }]),
    Lead.find({ ...lf, status: { $nin: LEAD_CLOSED }, nextFollowUpDate: { $lte: now } })
      .sort("nextFollowUpDate")
      .limit(25)
      .select("name restaurantName phone status nextFollowUpDate")
      .lean(),
    IfoConversion.aggregate([
      { $match: { ...iff, conversionDate: { $gte: mStart } } },
      { $group: { _id: null, v: { $sum: "$dealValue" }, c: { $sum: 1 } } },
    ]),
    IfoConversion.aggregate([
      { $match: iff },
      { $group: { _id: null, v: { $sum: "$dealValue" }, c: { $sum: 1 }, collected: { $sum: "$amountReceived" } } },
    ]),
    user.role === "salesperson"
      ? Target.findOne({ salesperson: user._id, month: now.getMonth() + 1, year: now.getFullYear() }).lean()
      : null,
  ]);

  const totalLeads = statusRows.reduce((a, r) => a + r.c, 0);
  const byStatus = statusRows.map((r) => `${LEAD_STATUS_LABELS[r._id] || r._id}=${r.c}`).join(", ");

  const lines = [];
  lines.push(`Today: ${now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  lines.push(`User: ${user.name} (role: ${user.role})`);
  lines.push("");
  lines.push(`TOTAL LEADS IN SCOPE: ${totalLeads}`);
  lines.push(`Leads by stage: ${byStatus || "none"}`);
  lines.push("");
  lines.push("FOLLOW-UPS DUE (today or overdue), up to 25:");
  if (!followUps.length) lines.push("  none");
  else
    for (const l of followUps)
      lines.push(
        `  - ${l.name}${l.restaurantName ? ` (${l.restaurantName})` : ""}, ${l.phone}, stage: ${
          LEAD_STATUS_LABELS[l.status] || l.status
        }, due ${new Date(l.nextFollowUpDate).toLocaleDateString("en-IN")}`
      );
  lines.push("");
  lines.push(`THIS MONTH: ${monthConv[0]?.c || 0} conversion(s), revenue ${inr(monthConv[0]?.v || 0)}.`);
  lines.push(`ALL TIME: ${allConv[0]?.c || 0} conversion(s), revenue ${inr(allConv[0]?.v || 0)}, collected ${inr(allConv[0]?.collected || 0)}.`);
  if (target) {
    lines.push("");
    lines.push(
      `TARGET THIS MONTH: leads ${target.leadTarget}, calls ${target.callTarget}, conversions ${target.conversionTarget}, revenue ${inr(
        target.revenueTarget
      )}.`
    );
  }

  if (user.role !== "salesperson") {
    const ids = await scopedSalespeople(user);
    if (ids.length) {
      const [people, rows] = await Promise.all([
        User.find({ _id: { $in: ids } }).select("name").lean(),
        Lead.aggregate([
          { $match: { assignedTo: { $in: ids } } },
          { $group: { _id: { sp: "$assignedTo", s: "$status" }, c: { $sum: 1 } } },
        ]),
      ]);
      const byPerson = {};
      for (const r of rows) {
        const k = String(r._id.sp);
        (byPerson[k] ||= {})[r._id.s] = r.c;
      }
      lines.push("");
      lines.push(`TEAM (${people.length} salesperson${people.length === 1 ? "" : "s"}):`);
      for (const p of people) {
        const bs = byPerson[String(p._id)] || {};
        const total = Object.values(bs).reduce((a, b) => a + b, 0);
        const open = Object.entries(bs)
          .filter(([s]) => !LEAD_CLOSED.includes(s))
          .reduce((a, [, c]) => a + c, 0);
        lines.push(`  - ${p.name}: ${total} leads total, ${open} open`);
      }
    }
  }

  return lines.join("\n");
}

// @route POST /api/assistant/chat   { message, history?: [{role, content}] }
export const chat = asyncHandler(async (req, res) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(503);
    throw new Error("The assistant isn't set up yet — ask an admin to add a GROQ_API_KEY.");
  }

  const message = String(req.body.message || "").trim();
  if (!message) {
    res.status(400);
    throw new Error("Say something first.");
  }
  if (message.length > MAX_MESSAGE_LEN) {
    res.status(400);
    throw new Error("That message is too long.");
  }

  const history = (Array.isArray(req.body.history) ? req.body.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const context = await buildContext(req.user);

  const systemPrompt =
    `You are the "Ask" assistant inside the RBH Sales CRM (Red Bean Hospitality), which tracks leads through a ` +
    `Lead -> Zoom -> Event -> Conversion pipeline. You're talking to ${req.user.name} (role: ${req.user.role}).\n\n` +
    `Rules:\n` +
    `- You may ONLY use the data in the "SCOPED DATA" block below. It is already filtered to exactly what this ` +
    `user is allowed to see (their own leads if a salesperson, their team's if a manager, the whole company if an admin).\n` +
    `- Never claim or imply access to any other salesperson's data unless it is explicitly listed below.\n` +
    `- If asked something this data doesn't cover, say plainly you don't have that information — never guess or invent numbers.\n` +
    `- Be concise and practical. Match the user's language/mix (Hindi, English, or Hinglish are all fine).\n\n` +
    `--- SCOPED DATA (live, as of now) ---\n${context}`;

  let groqRes;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
        temperature: 0.3,
        max_tokens: 800,
        reasoning_effort: "low",
      }),
    });
  } catch {
    res.status(502);
    throw new Error("Couldn't reach the assistant service — try again in a moment.");
  }

  if (!groqRes.ok) {
    const detail = await groqRes.text().catch(() => "");
    console.error("[assistant] Groq error", groqRes.status, detail.slice(0, 500));
    res.status(502);
    throw new Error("The assistant hit an error — try again in a moment.");
  }

  const data = await groqRes.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    res.status(502);
    throw new Error("The assistant didn't return a reply — try again.");
  }

  res.json({ reply });
});
