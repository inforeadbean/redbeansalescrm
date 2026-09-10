import api from "./api.js";

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  localStorage.setItem("rbh_token", data.token);
  localStorage.setItem("rbh_user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("rbh_token");
  localStorage.removeItem("rbh_user");
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("rbh_user"));
  } catch {
    return null;
  }
}

export const updateProfile = (body) => api.put("/auth/me", body).then((r) => r.data.user);
export const changePassword = (body) =>
  api.post("/auth/change-password", body).then((r) => r.data);
