import api from "./api.js";

export const listEvents = (params) => api.get("/events", { params }).then((r) => r.data);
export const getEvent = (id) => api.get(`/events/${id}`).then((r) => r.data);
export const createEvent = (body) => api.post("/events", body).then((r) => r.data);
export const updateEvent = (id, body) => api.put(`/events/${id}`, body).then((r) => r.data);
export const deleteEvent = (id) => api.delete(`/events/${id}`).then((r) => r.data);
export const addInvitees = (id, leadIds) =>
  api.post(`/events/${id}/invitees`, { leadIds }).then((r) => r.data);
export const setInvitee = (id, inviteeId, body) =>
  api.patch(`/events/${id}/invitees/${inviteeId}`, body).then((r) => r.data);
export const removeInvitee = (id, inviteeId) =>
  api.delete(`/events/${id}/invitees/${inviteeId}`).then((r) => r.data);
