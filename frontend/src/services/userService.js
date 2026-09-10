import api from "./api.js";

export const listUsers = (params) => api.get("/users", { params }).then((r) => r.data);
export const getAssignable = () => api.get("/users/team").then((r) => r.data);
export const getUser = (id) => api.get(`/users/${id}`).then((r) => r.data);
export const createUser = (body) => api.post("/users", body).then((r) => r.data);
export const updateUser = (id, body) => api.put(`/users/${id}`, body).then((r) => r.data);
export const setUserStatus = (id, status) =>
  api.patch(`/users/${id}/status`, { status }).then((r) => r.data);
// Returns { name, email, password } — the plain password, shown once.
export const resetUserPassword = (id, password) =>
  api.post(`/users/${id}/reset-password`, password ? { password } : {}).then((r) => r.data);
export const deleteUser = (id) => api.delete(`/users/${id}`).then((r) => r.data);
