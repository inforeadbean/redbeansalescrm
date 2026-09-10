import api from "./api.js";

export const listTargets = (params) => api.get("/targets", { params }).then((r) => r.data);
export const getMyTarget = (params) => api.get("/targets/me", { params }).then((r) => r.data);
export const upsertTarget = (body) => api.post("/targets", body).then((r) => r.data);
export const deleteTarget = (id) => api.delete(`/targets/${id}`).then((r) => r.data);
