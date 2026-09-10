import api from "./api.js";

// Reminders on a lead (for its panel), or the caller's own list with no args.
export const listReminders = (params) =>
  api.get("/reminders", { params }).then((r) => r.data);

// The notification-bell feed: the caller's own reminders whose time has passed.
export const getNotifications = () =>
  api.get("/reminders", { params: { view: "bell" } }).then((r) => r.data);

export const createReminder = (body) =>
  api.post("/reminders", body).then((r) => r.data);

export const updateReminder = (id, body) =>
  api.patch(`/reminders/${id}`, body).then((r) => r.data);

export const deleteReminder = (id) =>
  api.delete(`/reminders/${id}`).then((r) => r.data);

export const markReminderRead = (id) =>
  api.patch(`/reminders/${id}/read`).then((r) => r.data);

export const markAllRemindersRead = () =>
  api.post("/reminders/read-all").then((r) => r.data);
