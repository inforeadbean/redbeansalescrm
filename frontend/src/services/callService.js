import api from "./api.js";

export const listCalls = (params) => api.get("/calls", { params }).then((r) => r.data);
export const getToday = () => api.get("/calls/today").then((r) => r.data);
export const createCall = (body) => api.post("/calls", body).then((r) => r.data);
export const completeCall = (id, body) =>
  api.patch(`/calls/${id}/complete`, body).then((r) => r.data);
export const deleteCall = (id) => api.delete(`/calls/${id}`).then((r) => r.data);
