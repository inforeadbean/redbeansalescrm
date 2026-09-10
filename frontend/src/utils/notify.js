// Desktop (OS-level) notification helpers, kept separate from React so the
// context file can stay Fast-Refresh friendly.

// Ask for permission to show desktop notifications. Browsers only honour this
// from a user gesture, so call it from a click handler (e.g. saving a reminder).
export function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

// Raise one desktop notification. `onClick` runs when the user clicks it.
// Silently does nothing if permission hasn't been granted.
export function showDesktopNotification(title, { body, tag, onClick } = {}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
  } catch {
    /* some browsers disallow the constructor — caller still has an in-app toast */
  }
}
