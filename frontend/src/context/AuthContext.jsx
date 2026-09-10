import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authService from "../services/authService.js";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authService.getStoredUser());
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((u) => {
    setUser(u);
    if (u) localStorage.setItem("rbh_user", JSON.stringify(u));
    else localStorage.removeItem("rbh_user");
  }, []);

  // Re-validate the stored token against the server on first load — a
  // token surviving in localStorage doesn't mean it's still valid (it may
  // have expired, or the account may have been deactivated since the
  // browser tab was last open).
  useEffect(() => {
    const token = localStorage.getItem("rbh_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => applyUser(data.user))
      .catch(() => applyUser(null))
      .finally(() => setLoading(false));
  }, [applyUser]);

  const login = async (email, password) => {
    const loggedInUser = await authService.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // Pull the latest profile/role from the server (after an edit, or when a
  // screen wants to be sure it isn't showing a stale role).
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      applyUser(data.user);
      return data.user;
    } catch {
      return null;
    }
  }, [applyUser]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refresh, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
