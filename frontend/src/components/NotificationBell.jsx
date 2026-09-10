import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdNotificationsNone,
  MdNotificationsActive,
  MdClose,
  MdArrowForward,
} from "react-icons/md";
import { useNotifications } from "../context/NotificationContext.jsx";
import { fmtDateTime, fromNow } from "../utils/format.js";

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const nav = useNavigate();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (r) => {
    if (!r.readAt) markRead(r._id);
    setOpen(false);
    if (r.lead?._id) nav(`/leads/${r.lead._id}`);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
      >
        {unread ? <MdNotificationsActive size={22} /> : <MdNotificationsNone size={22} />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary-dark hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {items.map((r) => (
                <li
                  key={r._id}
                  className={`group flex items-start gap-2 px-4 py-3 ${r.readAt ? "" : "bg-primary-light/40"}`}
                >
                  <button
                    onClick={() => openItem(r)}
                    className="flex-1 text-left"
                    title={r.lead?.name ? `Open ${r.lead.name}` : undefined}
                  >
                    <p className="text-sm text-gray-800 leading-snug">
                      {!r.readAt && (
                        <span className="inline-block h-2 w-2 rounded-full bg-primary mr-1.5 align-middle" />
                      )}
                      {r.note}
                    </p>
                    {r.lead?.name && (
                      <p className="text-xs text-primary-dark font-medium mt-0.5 inline-flex items-center gap-1">
                        {r.lead.name} <MdArrowForward size={12} />
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {fmtDateTime(r.remindAt)} · {fromNow(r.remindAt)}
                    </p>
                  </button>
                  <button
                    onClick={() => dismiss(r._id)}
                    className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    aria-label="Dismiss"
                  >
                    <MdClose size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
