import axios from "axios";

// Relative by default ("/api") so the app works wherever it's served from —
// localhost, a LAN IP, or a shared tunnel URL. In dev, Vite proxies "/api" to
// the backend (see vite.config.js); in prod, put the API behind the same
// origin or set VITE_API_URL to its absolute URL at build time.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Attach the JWT to every request once the user is logged in.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rbh_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 means the token is missing/expired/invalid — clear the stale
// session and bounce to login instead of leaving the app stuck making
// doomed requests with a dead token.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("rbh_token");
      localStorage.removeItem("rbh_user");
      window.location.href = "/login";
    }
    return Promise.reject(err.response?.data?.message || err.message);
  }
);

export default api;
