import { createContext, useCallback, useContext, useState } from "react";
import { MdCheckCircle, MdError, MdInfo, MdClose } from "react-icons/md";

// Lightweight toast system — no dependency. `useToast()` returns
// { success, error, info }, each taking a message string. Toasts auto-dismiss
// after 4s and stack bottom-right.
const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: MdCheckCircle, ring: "border-green-200", accent: "text-green-600" },
  error: { icon: MdError, ring: "border-red-200", accent: "text-red-600" },
  info: { icon: MdInfo, ring: "border-blue-200", accent: "text-blue-600" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (variant, message) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, variant, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const api = {
    success: (m) => push("success", m),
    error: (m) => push("error", typeof m === "string" ? m : "Something went wrong."),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map(({ id, variant, message }) => {
          const v = VARIANTS[variant] || VARIANTS.info;
          const Icon = v.icon;
          return (
            <div
              key={id}
              className={`flex items-start gap-3 bg-white rounded-xl border ${v.ring} shadow-lg px-4 py-3 text-sm animate-[slidein_.15s_ease-out]`}
              role="status"
            >
              <Icon className={`${v.accent} shrink-0 mt-0.5`} size={18} />
              <p className="flex-1 text-gray-700 leading-snug">{message}</p>
              <button onClick={() => dismiss(id)} className="text-gray-300 hover:text-gray-500">
                <MdClose size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside a ToastProvider");
  return ctx;
}
