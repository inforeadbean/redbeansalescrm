import api from "./api.js";

export const listWebinars = (params) => api.get("/webinars", { params }).then((r) => r.data);
export const getWebinar = (id) => api.get(`/webinars/${id}`).then((r) => r.data);
export const createWebinar = (body) => api.post("/webinars", body).then((r) => r.data);
export const updateWebinar = (id, body) => api.put(`/webinars/${id}`, body).then((r) => r.data);
export const deleteWebinar = (id) => api.delete(`/webinars/${id}`).then((r) => r.data);
export const addRegistrations = (id, leadIds) =>
  api.post(`/webinars/${id}/registrations`, { leadIds }).then((r) => r.data);
export const setAttendance = (id, regId, attended) =>
  api.patch(`/webinars/${id}/registrations/${regId}`, { attended }).then((r) => r.data);
export const removeRegistration = (id, regId) =>
  api.delete(`/webinars/${id}/registrations/${regId}`).then((r) => r.data);
