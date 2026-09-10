import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { useToast } from "./ToastContext.jsx";
import { ensureNotificationPermission, showDesktopNotification } from "../utils/notify.js";
import {
  getNotifications,
  markReminderRead,
  markAllRemindersRead,
  deleteReminder,
} from "../services/reminderService.js";

// Drives the top-bar notification bell. There is no server push — a reminder
// simply becomes "due" once its time passes, so we poll the bell endpoint on
// an interval and whenever the tab regains focus. The first time we see a due,
// unread reminder we also raise a desktop notification (best effort — only
// while the CRM is open in a browser).
const NotificationContext = createContext(null);

const POLL_MS = 30000;
const ALERTED_KEY = "rbh_alerted_reminders";

function loadAlerted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(ALERTED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveAlerted(set) {
  try {
    localStorage.setItem(ALERTED_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* storage blocked — worst case a desktop pop-up repeats, not fatal */
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const alertedRef = useRef(loadAlerted());

  const raiseDesktop = useCallback(
    (r) => {
      const title = r.lead?.name ? `Reminder · ${r.lead.name}` : "Reminder";
      showDesktopNotification(title, {
        body: r.note,
        tag: r._id,
        onClick: () => r.lead?._id && nav(`/leads/${r.lead._id}`),
      });
      toast.info(`${title}: ${r.note}`);
    },
    [toast, nav]
  );

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const { items: next = [] } = await getNotifications();
      setItems(next);

      const fresh = next.filter((r) => !r.readAt && !alertedRef.current.has(r._id));
      if (fresh.length) {
        fresh.forEach(raiseDesktop);
        fresh.forEach((r) => alertedRef.current.add(r._id));
        saveAlerted(alertedRef.current);
      }
    } catch {
      /* transient — the next poll retries */
    }
  }, [user, raiseDesktop]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    ensureNotificationPermission();
    reload();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user, reload]);

  const markRead = useCallback(async (id) => {
    setItems((list) =>
      list.map((r) => (r._id === id && !r.readAt ? { ...r, readAt: new Date().toISOString() } : r))
    );
    try {
      await markReminderRead(id);
    } catch {
      reload();
    }
  }, [reload]);

  const markAllRead = useCallback(async () => {
    setItems((list) => list.map((r) => (r.readAt ? r : { ...r, readAt: new Date().toISOString() })));
    try {
      await markAllRemindersRead();
    } catch {
      reload();
    }
  }, [reload]);

  const dismiss = useCallback(async (id) => {
    setItems((list) => list.filter((r) => r._id !== id));
    try {
      await deleteReminder(id);
    } catch {
      reload();
    }
  }, [reload]);

  const value = useMemo(
    () => ({
      items,
      unread: items.filter((r) => !r.readAt).length,
      reload,
      markRead,
      markAllRead,
      dismiss,
    }),
    [items, reload, markRead, markAllRead, dismiss]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside a NotificationProvider");
  return ctx;
}
