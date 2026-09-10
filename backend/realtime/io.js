import { Server } from "socket.io";
import jwt from "jsonwebtoken";

// Real-time layer. Controllers/models never talk to socket.io directly — they
// call `emitSync(topics, { users, staff })`, which coalesces a burst of writes
// into one "sync" hint per client. The client reacts by silently re-fetching
// whatever depends on those topics. It's a nudge, not the data itself, so
// scoping stays with the existing (already role-scoped) REST endpoints.

let io = null;
const ROOM_STAFF = "staff"; // admins + managers
const roomUser = (id) => `user:${String(id)}`;

export function initRealtime(httpServer, clientOrigins) {
  io = new Server(httpServer, {
    cors: { origin: clientOrigins, credentials: true },
    // Modest limits — this is a small internal team.
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authorized"));
    try {
      const { id, role } = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = String(id);
      socket.data.role = role;
      next();
    } catch {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(roomUser(socket.data.userId));
    if (socket.data.role === "admin" || socket.data.role === "manager") {
      socket.join(ROOM_STAFF);
    }
  });

  console.log("[Realtime] socket.io ready");
  return io;
}

// --- burst coalescing -------------------------------------------------------
let pending = null; // { topics:Set, users:Set, staff:bool }
let flushTimer = null;

function flush() {
  flushTimer = null;
  if (!pending || !io) {
    pending = null;
    return;
  }
  const payload = { topics: [...pending.topics], at: Date.now() };
  if (pending.staff) io.to(ROOM_STAFF).emit("sync", payload);
  for (const u of pending.users) io.to(roomUser(u)).emit("sync", payload);
  pending = null;
}

// Nudge clients to refresh. `topics` ∈ leads|reminders|conversions|calls|dashboard.
// `users` = extra user ids that should refresh (e.g. the lead's owner);
// `staff` = also every admin/manager (default true).
export function emitSync(topics, { users = [], staff = true } = {}) {
  if (!io) return; // seed scripts / tests run without a server
  const list = Array.isArray(topics) ? topics : [topics];
  pending ??= { topics: new Set(), users: new Set(), staff: false };
  list.forEach((t) => pending.topics.add(t));
  users.filter(Boolean).forEach((u) => pending.users.add(String(u)));
  pending.staff ||= staff;
  if (!flushTimer) flushTimer = setTimeout(flush, 200);
}

// A reminder "becomes due" purely with the passage of time — no write fires —
// so poll for that transition and nudge the owners. 30s granularity is plenty.
export function startReminderTicker() {
  let since = new Date();
  const tick = async () => {
    if (!io) return;
    const now = new Date();
    try {
      const { default: Reminder } = await import("../models/Reminder.js");
      const users = await Reminder.find({
        remindAt: { $gt: since, $lte: now },
        readAt: { $exists: false },
      }).distinct("user");
      since = now;
      for (const u of users) emitSync(["reminders"], { users: [u], staff: false });
    } catch {
      /* transient — try again next tick */
    }
  };
  setInterval(tick, 30000);
}

export const getIo = () => io;
