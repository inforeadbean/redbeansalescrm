import api from "./api.js";

export const listIfo = (params) => api.get("/ifo", { params }).then((r) => r.data);
export const getIfo = (id) => api.get(`/ifo/${id}`).then((r) => r.data);
export const createIfo = (body) => api.post("/ifo", body).then((r) => r.data);
export const addPayment = (id, body) => api.post(`/ifo/${id}/payments`, body).then((r) => r.data);
export const updateIfo = (id, body) => api.put(`/ifo/${id}`, body).then((r) => r.data);
export const deleteIfo = (id) => api.delete(`/ifo/${id}`).then((r) => r.data);
